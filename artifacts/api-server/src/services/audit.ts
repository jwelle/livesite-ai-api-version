import { db, adminAuditLogTable } from "@workspace/db";

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

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
