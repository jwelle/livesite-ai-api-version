import { Router } from "express";
import { db, usersTable, demosTable, adminAuditLogTable } from "@workspace/db";
import { eq, ilike, or, sql, desc, count, inArray } from "drizzle-orm";
import { requireAdmin, blockDuringImpersonation } from "../middlewares/authMiddleware";
import { logAdminAction } from "../services/audit";
import { updateSession, getSession } from "../lib/auth";

const router = Router();

router.use((req, res, next) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
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

router.get("/admin/users", async (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const searchFilter = search
    ? or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`),
      )
    : undefined;

  const baseQuery = searchFilter
    ? db.select().from(usersTable).where(searchFilter)
    : db.select().from(usersTable);

  const users = await baseQuery
    .orderBy(desc(usersTable.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await (searchFilter
    ? db.select({ total: count() }).from(usersTable).where(searchFilter)
    : db.select({ total: count() }).from(usersTable));

  // Demo counts and last activity per user
  const userIds = users.map((u) => u.id);
  const demoStats = userIds.length
    ? await db
        .select({
          userId: demosTable.userId,
          demoCount: count(),
          lastActivity: sql<Date | null>`MAX(${demosTable.updatedAt})`,
        })
        .from(demosTable)
        .where(inArray(demosTable.userId, userIds))
        .groupBy(demosTable.userId)
    : [];
  const statsMap = new Map(demoStats.map((s) => [s.userId, s]));

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
        createdAt: u.createdAt,
        demoCount: s?.demoCount ?? 0,
        lastActivity: s?.lastActivity ?? null,
      };
    }),
  });
});

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

router.post("/admin/users/:id/suspend", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [target] = await db
    .update(usersTable)
    .set({ status: "suspended" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "suspend_user",
    targetType: "user",
    targetId: id,
    details: { email: target.email },
  });
  res.json({ success: true, user: { id: target.id, status: target.status } });
});

router.post("/admin/users/:id/reactivate", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [target] = await db
    .update(usersTable)
    .set({ status: "active" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "reactivate_user",
    targetType: "user",
    targetId: id,
    details: { email: target.email },
  });
  res.json({ success: true, user: { id: target.id, status: target.status } });
});

router.post("/admin/users/:id/promote", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  const [target] = await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "promote_user",
    targetType: "user",
    targetId: id,
    details: { email: target.email },
  });
  res.json({ success: true, user: { id: target.id, role: target.role } });
});

router.post("/admin/users/:id/demote", blockDuringImpersonation, async (req, res) => {
  const id = req.params.id as string;
  if (id === req.realUser!.id) {
    res.status(400).json({ error: "You cannot demote yourself." });
    return;
  }
  const [target] = await db
    .update(usersTable)
    .set({ role: "user" })
    .where(eq(usersTable.id, id))
    .returning();
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAdminAction({
    actorId: req.realUser!.id,
    actorEmail: req.realUser!.email,
    action: "demote_user",
    targetType: "user",
    targetId: id,
    details: { email: target.email },
  });
  res.json({ success: true, user: { id: target.id, role: target.role } });
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

router.post("/admin/impersonate/exit", async (req, res) => {
  const sid = req.sessionId;
  if (!sid) {
    res.status(401).json({ error: "Unauthorized" });
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
    res.status(400).json({ error: "Cannot impersonate yourself." });
    return;
  }
  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const sid = req.sessionId!;
  const session = await getSession(sid);
  if (!session) {
    res.status(401).json({ error: "Session not found" });
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

export default router;
