import { and, eq, sql } from "drizzle-orm";
import { db, dailyUsageTable, demosTable, usersTable, type User } from "@workspace/db";
import { sendError, type ErrorCode } from "../lib/errors";
import { config, getUsageDateString } from "../lib/config";
import type { Response } from "express";

export interface UsageSnapshot {
  tier: "free" | "pro";
  status: "active" | "suspended" | "pending_approval";
  demosCreated: number;
  demoLimit: number | null;
  enrichmentsToday: number;
  dailyEnrichmentLimit: number | null;
  totalEnrichments: number;
  usageDate: string;
}

export async function getDemoCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(demosTable)
    .where(eq(demosTable.userId, userId));
  return row?.c ?? 0;
}

export async function getEnrichmentsToday(userId: string): Promise<number> {
  const today = getUsageDateString();
  const [row] = await db
    .select({ c: dailyUsageTable.enrichmentCount })
    .from(dailyUsageTable)
    .where(
      and(eq(dailyUsageTable.userId, userId), eq(dailyUsageTable.usageDate, today)),
    );
  return row?.c ?? 0;
}

export async function getTotalEnrichments(userId: string): Promise<number> {
  const [row] = await db
    .select({
      c: sql<number>`coalesce(sum(${dailyUsageTable.enrichmentCount}), 0)::int`,
    })
    .from(dailyUsageTable)
    .where(eq(dailyUsageTable.userId, userId));
  return row?.c ?? 0;
}

export async function getUsageSnapshot(user: User): Promise<UsageSnapshot> {
  const [demos, today, total] = await Promise.all([
    getDemoCount(user.id),
    getEnrichmentsToday(user.id),
    getTotalEnrichments(user.id),
  ]);
  const tier = (user.tier as "free" | "pro") ?? "free";
  const role = (user.role as "user" | "admin") ?? "user";
  const status = (user.status as UsageSnapshot["status"]) ?? "active";
  const isAdmin = role === "admin";
  return {
    tier,
    status,
    demosCreated: demos,
    demoLimit: isAdmin ? null : tier === "free" ? config.freeUserTotalDemos : null,
    enrichmentsToday: today,
    dailyEnrichmentLimit: isAdmin ? null : config.proUserDailyEnrichments,
    totalEnrichments: total,
    usageDate: getUsageDateString(),
  };
}

/**
 * Verify the user is allowed to create another demo. Returns true if allowed,
 * otherwise sends a structured error response and returns false.
 */
export async function checkCanCreateDemo(
  user: { id: string; tier?: string | null; role?: string | null },
  res: Response,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const tier = user.tier ?? "free";
  if (tier !== "free") return true;
  const count = await getDemoCount(user.id);
  if (count >= config.freeUserTotalDemos) {
    sendError(res, "FREE_DEMO_LIMIT_REACHED");
    return false;
  }
  return true;
}

/**
 * Verify the user is allowed to run another enrichment today. Returns true if
 * allowed, otherwise sends a structured error response and returns false.
 * Does NOT consume quota; call recordEnrichment after a successful enrichment.
 */
export async function checkCanRunEnrichment(
  user: { id: string; role?: string | null },
  res: Response,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const today = await getEnrichmentsToday(user.id);
  if (today >= config.proUserDailyEnrichments) {
    sendError(res, "DAILY_ENRICHMENT_LIMIT_REACHED");
    return false;
  }
  return true;
}

/**
 * Atomically increment today's enrichment count. Call after a successful
 * enrichment so failed requests don't consume quota.
 */
export async function recordEnrichment(userId: string): Promise<void> {
  const today = getUsageDateString();
  await db
    .insert(dailyUsageTable)
    .values({ userId, usageDate: today, enrichmentCount: 1 })
    .onConflictDoUpdate({
      target: [dailyUsageTable.userId, dailyUsageTable.usageDate],
      set: {
        enrichmentCount: sql`${dailyUsageTable.enrichmentCount} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function touchLastLogin(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, userId));
}

export type { ErrorCode };
