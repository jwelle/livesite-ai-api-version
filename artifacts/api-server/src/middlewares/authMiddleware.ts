import { type NextFunction, type Request, type Response } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { sendError } from "../lib/errors";
import {
  getAccessToken,
  getImpersonationToken,
  getRealAndEffectiveUser,
  verifySupabaseAccessToken,
  type ImpersonationData,
} from "../lib/auth";
import { touchLastLogin } from "../services/usageService";

declare global {
  namespace Express {
    interface User
      extends Omit<AuthUser, "role" | "status" | "tier" | "impersonating"> {
      role?: string;
      status?: string;
      tier?: string;
      supabaseAuthUserId?: string | null;
    }

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
      realUser?: User | undefined;
      impersonation?: ImpersonationData | undefined;
      authClaims?: Record<string, unknown> | undefined;
      authToken?: string | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

const lastLoginTouchedAt = new Map<string, number>();
const LOGIN_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function maybeTouchLogin(userId: string): void {
  const now = Date.now();
  const previous = lastLoginTouchedAt.get(userId) ?? 0;
  if (now - previous < LOGIN_TOUCH_INTERVAL_MS) return;
  lastLoginTouchedAt.set(userId, now);
  void touchLastLogin(userId).catch(() => {
    /* swallow */
  });
}

function toExpressUser(
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    role: string | null;
    status: string | null;
    tier: string | null;
    supabaseAuthUserId: string | null;
  },
): Express.User {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    role: user.role ?? "user",
    status: user.status ?? "pending_approval",
    tier: user.tier ?? "free",
    supabaseAuthUserId: user.supabaseAuthUserId,
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const token = getAccessToken(req);
  if (!token) {
    next();
    return;
  }

  const claims = await verifySupabaseAccessToken(token);
  if (!claims) {
    next();
    return;
  }

  const { realUser, effectiveUser, impersonation } = await getRealAndEffectiveUser(
    claims,
    getImpersonationToken(req),
  );

  if (realUser.status === "suspended") {
    sendError(res, "ACCOUNT_SUSPENDED");
    return;
  }

  maybeTouchLogin(realUser.id);

  req.authClaims = claims as Record<string, unknown>;
  req.authToken = token;
  req.realUser = toExpressUser(realUser);
  req.user = toExpressUser(effectiveUser);
  req.impersonation = impersonation ?? undefined;

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

export function requireActiveUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

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
