import type { Response } from "express";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "ACCOUNT_PENDING_APPROVAL"
  | "ACCOUNT_SUSPENDED"
  | "ADMIN_REQUIRED"
  | "FREE_DEMO_LIMIT_REACHED"
  | "DAILY_ENRICHMENT_LIMIT_REACHED"
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "INVITE_CONSUMED"
  | "INVITE_REVOKED"
  | "INVITE_EMAIL_MISMATCH"
  | "NOT_FOUND";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "You must be signed in.",
  ACCOUNT_PENDING_APPROVAL:
    "Your account is awaiting approval. An administrator will review your request shortly.",
  ACCOUNT_SUSPENDED:
    "Your account has been suspended. Please contact support if you believe this is in error.",
  ADMIN_REQUIRED: "Admin access required.",
  FREE_DEMO_LIMIT_REACHED:
    "Free tier is limited to 1 demo. Contact us to upgrade.",
  DAILY_ENRICHMENT_LIMIT_REACHED:
    "Daily enrichment limit reached (25/25). Resets at midnight Eastern Time.",
  INVITE_INVALID: "This invite link is not valid.",
  INVITE_EXPIRED: "This invite link has expired.",
  INVITE_CONSUMED: "This invite link has already been used.",
  INVITE_REVOKED: "This invite link has been revoked.",
  INVITE_EMAIL_MISMATCH:
    "This invite link is for a different email address than the one you signed in with.",
  NOT_FOUND: "Resource not found.",
};

export const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  ACCOUNT_PENDING_APPROVAL: 403,
  ACCOUNT_SUSPENDED: 403,
  ADMIN_REQUIRED: 403,
  FREE_DEMO_LIMIT_REACHED: 403,
  DAILY_ENRICHMENT_LIMIT_REACHED: 429,
  INVITE_INVALID: 400,
  INVITE_EXPIRED: 400,
  INVITE_CONSUMED: 400,
  INVITE_REVOKED: 400,
  INVITE_EMAIL_MISMATCH: 400,
  NOT_FOUND: 404,
};

export function sendError(
  res: Response,
  code: ErrorCode,
  messageOverride?: string,
): void {
  res
    .status(STATUS_FOR_CODE[code])
    .json({ error: code, message: messageOverride ?? DEFAULT_MESSAGES[code] });
}

export function errorMessage(code: ErrorCode): string {
  return DEFAULT_MESSAGES[code];
}
