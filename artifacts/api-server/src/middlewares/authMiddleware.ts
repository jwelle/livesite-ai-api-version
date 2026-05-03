import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
  type ImpersonationData,
} from "../lib/auth";
import { sendError } from "../lib/errors";
import { touchLastLogin } from "../services/usageService";

declare global {
  namespace Express {
    interface User extends Omit<AuthUser, "role" | "status" | "tier" | "impersonating"> {
      role?: string;
      status?: string;
      tier?: string;
    }

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
      realUser?: User | undefined;
      impersonation?: ImpersonationData | undefined;
      sessionId?: string | undefined;
      sessionData?: SessionData | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(
      config,
      session.refresh_token,
    );
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
  }
}

// Throttle last_login_at writes per process to avoid hammering on every API call.
const lastLoginTouchedAt = new Map<string, number>();
const LOGIN_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
function maybeTouchLogin(userId: string): void {
  const now = Date.now();
  const prev = lastLoginTouchedAt.get(userId) ?? 0;
  if (now - prev < LOGIN_TOUCH_INTERVAL_MS) return;
  lastLoginTouchedAt.set(userId, now);
  void touchLastLogin(userId).catch(() => {
    /* swallow */
  });
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  const refreshed = await refreshIfExpired(sid, session);
  if (!refreshed) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Load fresh role/status/tier for the real user.
  const [realDbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, refreshed.user.id));

  if (!realDbUser) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Suspended users have their session destroyed at the middleware layer so
  // no API surface is reachable. Pending users keep a valid session — route
  // guards will gate which endpoints they can reach.
  if (realDbUser.status === "suspended") {
    await clearSession(res, sid);
    sendError(res, "ACCOUNT_SUSPENDED");
    return;
  }

  maybeTouchLogin(realDbUser.id);

  const realUser: Express.User = {
    id: realDbUser.id,
    email: realDbUser.email,
    firstName: realDbUser.firstName,
    lastName: realDbUser.lastName,
    profileImageUrl: realDbUser.profileImageUrl,
    role: realDbUser.role,
    status: realDbUser.status,
    tier: realDbUser.tier,
  };

  req.realUser = realUser;
  req.sessionId = sid;
  req.sessionData = refreshed;

  // Apply impersonation if present and the real user is an admin.
  if (refreshed.impersonation && realDbUser.role === "admin") {
    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, refreshed.impersonation.targetUserId));
    if (target) {
      req.user = {
        id: target.id,
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
        profileImageUrl: target.profileImageUrl,
        role: target.role,
        status: target.status,
        tier: target.tier,
      };
      req.impersonation = refreshed.impersonation;
      next();
      return;
    }
  }

  req.user = realUser;
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.realUser || req.realUser.role !== "admin") {
    sendError(res, "ADMIN_REQUIRED");
    return;
  }
  next();
}

/**
 * For routes that should only be reachable by users whose account is fully
 * approved. Admins (real or via impersonation of an active user) are always
 * considered active. Pending users are blocked with a structured error so the
 * client can render a "waiting for approval" screen.
 */
export function requireActiveUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  // Admins can always act, even if the impersonated target is pending (the
  // impersonation guard prevents mutations separately).
  if (req.realUser?.role === "admin") {
    next();
    return;
  }
  const status = req.user?.status ?? "pending_approval";
  if (status === "pending_approval") {
    sendError(res, "ACCOUNT_PENDING_APPROVAL");
    return;
  }
  if (status === "suspended") {
    sendError(res, "ACCOUNT_SUSPENDED");
    return;
  }
  next();
}

export function blockDuringImpersonation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.impersonation) {
    res.status(403).json({
      error: "IMPERSONATION_READONLY",
      message: "Mutating actions are blocked while viewing as another user.",
    });
    return;
  }
  next();
}
