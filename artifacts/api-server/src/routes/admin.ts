import { Router } from "express";
import {
  db,
  usersTable,
  demosTable,
  adminAuditLogTable,
  userInvitesTable,
  dailyUsageTable,
} from "@workspace/db";
import { eq, ilike, or, sql, desc, count, inArray, and } from "drizzle-orm";
import crypto from "crypto";
import { requireAdmin, blockDuringImpersonation } from "../middlewares/authMiddleware";
import { logAdminAction } from "../services/audit";
import { updateSession, getSession, clearSession } from "../lib/auth";
import { getUsageDateString } from "../lib/config";

const router = Router();

router.use((req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  next();
});

router.use(requireAdmin);

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function audit(req: Express.Request, action: string, targetId: string | null, details: unknown) {
  return logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action,
    targetType: "user",
    targetId,
    details,
  });
}

// ---- USERS ----------------------------------------------------------------
router.get("/admin/users", async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";

  const filters = [];
  if (search) {
    filters.push(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`),
      )!,
    );
  }
  if (statusFilter && ["pending_approval", "active", "suspended"].includes(statusFilter)) {
    filters.push(eq(usersTable.status, statusFilter));
  }
  const where = filters.length ? and(...filters) : undefined;

  const users = await (where ? db.select().from(usersTable).where(where) : db.select().from(usersTable))
    .orderBy(desc(usersTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await (where
    ? db.select({ total: count() }).from(usersTable).where(where)
    : db.select({ total: count() }).from(usersTable));

  const userIds = users.map((u) => u.id);
  const today = getUsageDateString();

  const [demoStats, todayStats, totalEnrich] = await Promise.all([
    userIds.length
      ? db
          .select({
            userId: demosTable.userId,
            demoCount: count(),
            lastActivity: sql<Date | null>`MAX(${demosTable.updatedAt})`,
          })
          .from(demosTable)
          .where(inArray(demosTable.userId, userIds))
          .groupBy(demosTable.userId)
      : Promise.resolve([] as Array<{ userId: string; demoCount: number; lastActivity: Date | null }>),
    userIds.length
      ? db
          .select({ userId: dailyUsageTable.userId, c: dailyUsageTable.enrichmentCount })
          .from(dailyUsageTable)
          .where(and(inArray(dailyUsageTable.userId, userIds), eq(dailyUsageTable.usageDate, today)))
      : Promise.resolve([] as Array<{ userId: string; c: number }>),
    userIds.length
      ? db
          .select({
            userId: dailyUsageTable.userId,
            c: sql<number>`coalesce(sum(${dailyUsageTable.enrichmentCount}),0)::int`,
          })
          .from(dailyUsageTable)
          .where(inArray(dailyUsageTable.userId, userIds))
          .groupBy(dailyUsageTable.userId)
      : Promise.resolve([] as Array<{ userId: string; c: number }>),
  ]);

  const statsMap = new Map(demoStats.map((s) => [s.userId, s]));
  const todayMap = new Map(todayStats.map((s) => [s.userId, s.c]));
  const totalMap = new Map(totalEnrich.map((s) => [s.userId, s.c]));

  res.json({
    page,
    pageSize,
    total,
    items: users.map((u) => {
      const s = statsMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: u.status,
        tier: u.tier,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        demoCount: s?.demoCount ?? 0,
        demosCreated: s?.demoCount ?? 0,
        enrichmentsToday: todayMap.get(u.id) ?? 0,
        totalEnrichments: totalMap.get(u.id) ?? 0,
        lastActivity: s?.lastActivity ?? null,
      };
    }),
  });
});

// Manual create-or-update by email.
router.post("/admin/users", blockDuringImpersonation, async (req, res) => {
  const body = req.body as { email?: unknown; tier?: unknown; role?: unknown; firstName?: unknown; lastName?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const tier = body.tier === "pro" ? "pro" : "free";
  const role = body.role === "admin" ? "admin" : "user";
  const firstName = typeof body.firstName === "string" ? body.firstName : null;
  const lastName = typeof body.lastName === "string" ? body.lastName : null;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "INVALID_EMAIL", message: "A valid email is required." });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${email})`);

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({
        tier,
        role,
        status: "active",
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
      })
      .where(eq(usersTable.id, existing.id))
      .returning();
    await audit(req, "user_manual_upsert", updated.id, { email, tier, role, mode: "update" });
    res.json({ user: updated, created: false });
    return;
  }

  // Create a placeholder row with a synthetic id. The real id is rewritten
  // when the user first signs in (see auth.ts/upsertUser).
  const placeholderId = `manual_${crypto.randomBytes(12).toString("hex")}`;
  const [created] = await db
    .insert(usersTable)
    .values({
      id: placeholderId,
      email,
      firstName,
      lastName,
      role,
      tier,
      status: "active",
    })
    .returning();
  await audit(req, "user_manual_upsert", created.id, { email, tier, role, mode: "create" });
  res.status(201).json({ user: created, created: true });
});

router.post("/admin/users/:id/approve", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [target] = await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }
  await audit(req, "user_approve", id, { email: target.email });
  res.json({ success: true, user: target });
});

router.post("/admin/users/:id/reject", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [target] = await db
    .update(usersTable)
    .set({ status: "suspended" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }
  // Best-effort: kill any active sessions for this user.
  await db.execute(sql`DELETE FROM sessions WHERE sess->'user'->>'id' = ${id}`);
  await audit(req, "user_reject", id, { email: target.email });
  res.json({ success: true, user: target });
});

router.post("/admin/users/:id/suspend", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  if (id === req.realUser!.id) {
    res.status(400).json({ error: "SELF_FORBIDDEN", message: "You cannot suspend your own account." });
    return;
  }
  const [target] = await db
    .update(usersTable)
    .set({ status: "suspended" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }
  await db.execute(sql`DELETE FROM sessions WHERE sess->'user'->>'id' = ${id}`);
  await audit(req, "user_suspend", id, { email: target.email });
  res.json({ success: true, user: target });
});

router.post("/admin/users/:id/reactivate", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [target] = await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }
  await audit(req, "user_reactivate", id, { email: target.email });
  res.json({ success: true, user: target });
});

router.post("/admin/users/:id/set-tier", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const tier = (req.body as { tier?: unknown }).tier;
  if (tier !== "free" && tier !== "pro") {
    res.status(400).json({ error: "INVALID_TIER", message: "Tier must be 'free' or 'pro'." });
    return;
  }
  const [target] = await db
    .update(usersTable)
    .set({ tier })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }
  await audit(req, "user_set_tier", id, { email: target.email, tier });
  res.json({ success: true, user: target });
});

router.post("/admin/users/:id/set-role", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const role = (req.body as { role?: unknown }).role;
  if (role !== "user" && role !== "admin") {
    res.status(400).json({ error: "INVALID_ROLE", message: "Role must be 'user' or 'admin'." });
    return;
  }
  if (id === req.realUser!.id && role === "user") {
    res.status(400).json({ error: "SELF_FORBIDDEN", message: "You cannot demote yourself." });
    return;
  }
  const [target] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }
  await audit(req, "user_set_role", id, { email: target.email, role });
  res.json({ success: true, user: target });
});

// ---- INVITES --------------------------------------------------------------
router.get("/admin/invites", async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>);
  const items = await db
    .select()
    .from(userInvitesTable)
    .orderBy(desc(userInvitesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  const [{ total }] = await db.select({ total: count() }).from(userInvitesTable);
  res.json({ page, pageSize, total, items });
});

router.post("/admin/invites", blockDuringImpersonation, async (req, res) => {
  const body = req.body as {
    tier?: unknown;
    invitedEmail?: unknown;
    expiresInDays?: unknown;
    note?: unknown;
  };
  const tier = body.tier === "pro" ? "pro" : "free";
  const invitedEmailRaw = typeof body.invitedEmail === "string" ? body.invitedEmail.trim() : "";
  const invitedEmail = invitedEmailRaw ? invitedEmailRaw.toLowerCase() : null;
  const expiresInDays = Number.isFinite(Number(body.expiresInDays)) ? Number(body.expiresInDays) : null;
  const note = typeof body.note === "string" ? body.note : null;

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = expiresInDays && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [invite] = await db
    .insert(userInvitesTable)
    .values({
      token,
      tier,
      invitedEmail,
      note,
      expiresAt,
      createdBy: req.realUser!.id,
    })
    .returning();

  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "invite_create",
    targetType: "invite",
    targetId: invite.id,
    details: { tier, invitedEmail, expiresAt },
  });
  res.status(201).json({ invite });
});

router.post("/admin/invites/:id/revoke", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [updated] = await db
    .update(userInvitesTable)
    .set({ revokedAt: new Date() })
    .where(eq(userInvitesTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "NOT_FOUND", message: "Invite not found" }); return; }
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "invite_revoke",
    targetType: "invite",
    targetId: id,
    details: null,
  });
  res.json({ success: true, invite: updated });
});

// ---- DEMOS / AUDIT (unchanged shape) -------------------------------------
router.get("/admin/demos", async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const searchFilter = search
    ? or(
        ilike(demosTable.companyName, `%${search}%`),
        ilike(demosTable.slug, `%${search}%`),
        ilike(usersTable.email, `%${search}%`),
      )
    : undefined;

  const rowsQuery = db
    .select({
      demo: demosTable,
      ownerEmail: usersTable.email,
    })
    .from(demosTable)
    .leftJoin(usersTable, eq(demosTable.userId, usersTable.id));

  const rows = await (searchFilter ? rowsQuery.where(searchFilter) : rowsQuery)
    .orderBy(desc(demosTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalQuery = db
    .select({ total: count() })
    .from(demosTable)
    .leftJoin(usersTable, eq(demosTable.userId, usersTable.id));
  const [{ total }] = await (searchFilter
    ? totalQuery.where(searchFilter)
    : totalQuery);

  res.json({
    page,
    pageSize,
    total,
    items: rows.map((r) => ({
      id: r.demo.id,
      companyName: r.demo.companyName,
      slug: r.demo.slug,
      status: r.demo.status,
      viewCount: r.demo.viewCount,
      callClickCount: r.demo.callClickCount,
      calendarClickCount: r.demo.calendarClickCount,
      createdAt: r.demo.createdAt,
      userId: r.demo.userId,
      ownerEmail: r.ownerEmail,
    })),
  });
});

router.get("/admin/audit-log", async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>);
  const items = await db
    .select()
    .from(adminAuditLogTable)
    .orderBy(desc(adminAuditLogTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: count() })
    .from(adminAuditLogTable);
  res.json({ page, pageSize, total, items });
});

// ---- IMPERSONATION (unchanged) -------------------------------------------
router.post("/admin/impersonate/exit", async (req, res) => {
  const sid = req.sessionId;
  if (!sid) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const session = await getSession(sid);
  if (!session?.impersonation) {
    res.json({ success: true });
    return;
  }
  const previous = session.impersonation;
  delete session.impersonation;
  await updateSession(sid, session);
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "impersonate_stop",
    targetType: "user",
    targetId: previous.targetUserId,
    details: { email: previous.targetEmail },
  });
  res.json({ success: true });
});

router.post("/admin/impersonate/:userId", blockDuringImpersonation, async (req, res) => {
  const targetId = req.params.userId as string;
  if (targetId === req.realUser!.id) {
    res.status(400).json({ error: "SELF_FORBIDDEN", message: "Cannot impersonate yourself." });
    return;
  }
  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    return;
  }
  const sid = req.sessionId!;
  const session = await getSession(sid);
  if (!session) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Session not found" });
    return;
  }
  session.impersonation = {
    targetUserId: target.id,
    targetEmail: target.email,
    startedAt: Date.now(),
  };
  await updateSession(sid, session);
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "impersonate_start",
    targetType: "user",
    targetId: target.id,
    details: { email: target.email },
  });
  res.json({
    success: true,
    impersonating: { targetUserId: target.id, targetEmail: target.email },
  });
});

// Suppress unused-warning for clearSession import (kept available for future use).
void clearSession;

export default router;
