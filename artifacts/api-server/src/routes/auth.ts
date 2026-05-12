import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireActiveUser } from "../middlewares/authMiddleware";
import {
  clearImpersonation,
  clearImpersonationCookie,
  finalizeInviteForUser,
  resolveInvite,
} from "../lib/auth";
import { sendError } from "../lib/errors";
import { logAdminAction } from "../services/audit";
import { getUsageSnapshot } from "../services/usageService";

const router: IRouter = Router();

function buildAuthPayload(req: Request) {
  if (!req.isAuthenticated()) return { user: null };
  const u = req.user;
  return {
    user: {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      profileImageUrl: u.profileImageUrl,
      role: u.role ?? "user",
      status: u.status ?? "active",
      tier: u.tier ?? "free",
      impersonating: req.impersonation
        ? {
            targetUserId: req.impersonation.targetUserId,
            targetEmail: req.impersonation.targetEmail,
          }
        : null,
    },
  };
}

router.get("/auth/me", (req: Request, res: Response) => {
  res.json(buildAuthPayload(req));
});

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(buildAuthPayload(req));
});

router.get("/auth/invite-status", async (req: Request, res: Response) => {
  const inviteToken =
    typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!inviteToken) {
    res.status(400).json({
      error: "INVITE_INVALID",
      message: "Invite token is required.",
    });
    return;
  }

  const resolution = await resolveInvite(inviteToken, null);
  if (!resolution.invite) {
    sendError(res, resolution.error ?? "INVITE_INVALID");
    return;
  }

  if (resolution.error && resolution.error !== "INVITE_CONSUMED") {
    sendError(res, resolution.error);
    return;
  }

  res.json({
    invite: {
      token: resolution.invite.token,
      tier: resolution.invite.tier,
      invitedEmail: resolution.invite.invitedEmail,
      expiresAt: resolution.invite.expiresAt,
      consumedAt: resolution.invite.consumedAt,
      revokedAt: resolution.invite.revokedAt,
    },
    status: resolution.error ?? "valid",
  });
});

router.post("/auth/finalize-invite", async (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.realUser) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  const inviteToken =
    typeof req.body?.inviteToken === "string" ? req.body.inviteToken.trim() : "";
  if (!inviteToken) {
    res.status(400).json({
      error: "INVITE_INVALID",
      message: "Invite token is required.",
    });
    return;
  }

  const resolution = await finalizeInviteForUser(
    req.realUser.id,
    req.realUser.email ?? null,
    inviteToken,
  );

  if (resolution.error) {
    sendError(res, resolution.error);
    return;
  }

  if (
    resolution.invite &&
    !(resolution.invite.consumedAt && resolution.invite.consumedByUserId === req.realUser.id)
  ) {
    await logAdminAction({
      actorId: resolution.invite.createdBy,
      actorEmail: null,
      action: "invite_consumed",
      targetType: "user",
      targetId: req.realUser.id,
      details: {
        token: resolution.invite.token,
        tier: resolution.invite.tier,
        email: req.realUser.email,
      },
    });
  }

  const [updatedUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.realUser.id));

  req.realUser = {
    ...req.realUser,
    status: updatedUser?.status ?? req.realUser.status,
    tier: updatedUser?.tier ?? req.realUser.tier,
  };
  req.user = req.impersonation ? req.user : req.realUser;

  res.json({
    success: true,
    invite: resolution.invite,
    ...buildAuthPayload(req),
  });
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  if (req.realUser) {
    await clearImpersonation(req.realUser.id);
  }
  clearImpersonationCookie(res);
  res.json({ success: true });
});

router.post("/logout", async (req: Request, res: Response) => {
  if (req.realUser) {
    await clearImpersonation(req.realUser.id);
  }
  clearImpersonationCookie(res);
  res.json({ success: true });
});

router.get("/logout", async (req: Request, res: Response) => {
  if (req.realUser) {
    await clearImpersonation(req.realUser.id);
  }
  clearImpersonationCookie(res);
  res.redirect("/");
});

router.get("/login", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "REPLACED",
    message: "Browser login now happens client-side via Supabase Auth.",
  });
});

router.get("/signup", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "REPLACED",
    message: "Signup now happens client-side via Supabase Auth.",
  });
});

router.get("/callback", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "REPLACED",
    message: "The legacy callback has been replaced by the Supabase Auth flow.",
  });
});

router.post("/mobile-auth/token-exchange", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "REPLACED",
    message: "Mobile token exchange has been removed with the Replit auth flow.",
  });
});

router.post("/mobile-auth/logout", (_req: Request, res: Response) => {
  res.json({ success: true });
});

router.get("/me/usage", requireActiveUser, async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const baseUser = req.user;
  const [dbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, baseUser.id));
  if (!dbUser) {
    res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
    return;
  }
  const snapshot = await getUsageSnapshot(dbUser);
  res.json(snapshot);
});

export default router;
