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

declare global {
  namespace Express {
    interface User extends Omit<AuthUser, "role" | "status" | "impersonating"> {
      role?: string;
      status?: string;
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

  // Load fresh role/status for the real user
  const [realDbUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, refreshed.user.id));

  if (!realDbUser) {
    await clearSession(res, sid);
    next();
    return;
  }

  if (realDbUser.status === "suspended") {
    await clearSession(res, sid);
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  const realUser: Express.User = {
    id: realDbUser.id,
    email: realDbUser.email,
    firstName: realDbUser.firstName,
    lastName: realDbUser.lastName,
    profileImageUrl: realDbUser.profileImageUrl,
    role: realDbUser.role,
    status: realDbUser.status,
  };

  req.realUser = realUser;
  req.sessionId = sid;
  req.sessionData = refreshed;

  // Apply impersonation if present and the real user is an admin
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
    res.status(403).json({ error: "Admin access required" });
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
      error: "Mutating actions are blocked while viewing as another user.",
    });
    return;
  }
  next();
}
