import { db, adminAuditLogTable } from "@workspace/db";
import { config } from "../lib/config";

export async function logAdminAction(params: {
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: unknown;
}): Promise<void> {
  await db.insert(adminAuditLogTable).values({
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    action: params.action,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    details: params.details ? JSON.stringify(params.details) : null,
  });
}

export function getInitialAdminEmails(): string[] {
  return config.initialAdminEmails;
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getInitialAdminEmails().includes(email.toLowerCase());
}
