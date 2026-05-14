import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Request, Response } from "express";
import {
  adminImpersonationsTable,
  db,
  userInvitesTable,
  usersTable,
  type UserInvite,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { isBootstrapAdmin } from "../services/audit";
import { config as appConfig } from "./config";
import { logger } from "./logger";

export const IMPERSONATION_COOKIE = "lsi_impersonation";
export const IMPERSONATION_TTL = 8 * 60 * 60 * 1000;

export interface ImpersonationData {
  targetUserId: string;
  targetEmail: string | null;
  startedAt: number;
}

export interface SupabaseAuthClaims extends JWTPayload {
  email?: string | null;
  phone?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export type InviteErrorCode =
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "INVITE_CONSUMED"
  | "INVITE_REVOKED"
  | "INVITE_EMAIL_MISMATCH";

export interface InviteResolution {
  invite: UserInvite | null;
  error?: InviteErrorCode;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getSupabaseUrl(): string {
  const value = process.env.SUPABASE_URL;
  if (!value) {
    throw new Error("SUPABASE_URL must be set for Supabase Auth.");
  }
  return trimTrailingSlash(value);
}

export function getSupabaseIssuer(): string {
  return `${getSupabaseUrl()}/auth/v1`;
}

function getSupabaseAudience(): string {
  return process.env.SUPABASE_JWT_AUDIENCE || "authenticated";
}

function getJwks() {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(
      new URL(`${getSupabaseIssuer()}/.well-known/jwks.json`),
    );
  }
  return jwksCache;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function getString(
  record: Record<string, unknown> | undefined,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getDatabaseErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  const pgCause =
    "cause" in error && error.cause && typeof error.cause === "object"
      ? (error.cause as Record<string, unknown>)
      : null;

  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
    cause: pgCause
      ? {
          message:
            typeof pgCause.message === "string" ? pgCause.message : undefined,
          code: typeof pgCause.code === "string" ? pgCause.code : undefined,
          detail:
            typeof pgCause.detail === "string" ? pgCause.detail : undefined,
          hint: typeof pgCause.hint === "string" ? pgCause.hint : undefined,
          schema:
            typeof pgCause.schema === "string" ? pgCause.schema : undefined,
          table: typeof pgCause.table === "string" ? pgCause.table : undefined,
          column:
            typeof pgCause.column === "string" ? pgCause.column : undefined,
          constraint:
            typeof pgCause.constraint === "string"
              ? pgCause.constraint
              : undefined,
        }
      : undefined,
  };
}

function splitFullName(fullName: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function deriveProfile(claims: SupabaseAuthClaims) {
  const metadata = claims.user_metadata ?? {};
  const fullName = getString(metadata, "full_name", "name", "user_name");
  const split = splitFullName(fullName);

  return {
    email: normalizeEmail(claims.email),
    firstName:
      getString(metadata, "first_name", "given_name") ?? split.firstName,
    lastName:
      getString(metadata, "last_name", "family_name") ?? split.lastName,
    profileImageUrl:
      getString(metadata, "avatar_url", "picture", "profile_image_url"),
  };
}

function getCookieSecurityOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function setImpersonationCookie(res: Response, token: string) {
  res.cookie(IMPERSONATION_COOKIE, token, {
    ...getCookieSecurityOptions(),
    maxAge: IMPERSONATION_TTL,
  });
}

export function clearImpersonationCookie(res: Response) {
  res.clearCookie(IMPERSONATION_COOKIE, getCookieSecurityOptions());
}

export function getImpersonationToken(req: Request): string | undefined {
  const value = req.cookies?.[IMPERSONATION_COOKIE];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function getAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

export async function verifySupabaseAccessToken(
  token: string,
): Promise<SupabaseAuthClaims | null> {
  try {
    const verified = await jwtVerify(token, getJwks(), {
      issuer: getSupabaseIssuer(),
      audience: getSupabaseAudience(),
    });
    return verified.payload as SupabaseAuthClaims;
  } catch (jwksError) {
    const legacySecret = process.env.SUPABASE_JWT_SECRET;
    if (!legacySecret) return null;

    try {
      const verified = await jwtVerify(
        token,
        new TextEncoder().encode(legacySecret),
        {
          issuer: getSupabaseIssuer(),
          audience: getSupabaseAudience(),
        },
      );
      return verified.payload as SupabaseAuthClaims;
    } catch {
      return null;
    }
  }
}

async function findExistingUserByClaims(claims: SupabaseAuthClaims) {
  const profile = deriveProfile(claims);
  const supabaseAuthUserId =
    typeof claims.sub === "string" && claims.sub.trim() ? claims.sub : null;
  if (!supabaseAuthUserId) {
    return null;
  }

  let bySupabaseId;
  try {
    [bySupabaseId] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.supabaseAuthUserId, supabaseAuthUserId));
  } catch (error) {
    logger.error(
      {
        supabaseAuthUserId,
        profileEmail: profile.email,
        dbError: getDatabaseErrorDetails(error),
      },
      "Failed to look up app user by Supabase auth user id",
    );
    throw error;
  }
  if (bySupabaseId) return bySupabaseId;

  if (!profile.email) return null;
  const [byEmail] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${profile.email})`);
  return byEmail ?? null;
}

async function shouldBootstrapAdmin(email: string | null, isNew: boolean) {
  if (isBootstrapAdmin(email)) return true;
  if (!isNew || appConfig.initialAdminEmails.length > 0) return false;
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable);
  return c === 0;
}

export async function upsertAppUserFromClaims(
  claims: SupabaseAuthClaims,
  options: { invite?: UserInvite | null } = {},
) {
  const supabaseAuthUserId =
    typeof claims.sub === "string" && claims.sub.trim() ? claims.sub : null;
  if (!supabaseAuthUserId) {
    throw new Error("Supabase JWT is missing a subject.");
  }

  const profile = deriveProfile(claims);
  const existing = await findExistingUserByClaims(claims);
  const isNew = !existing;
  const promoteToAdmin = await shouldBootstrapAdmin(profile.email, isNew);

  const initialStatus = isNew
    ? options.invite
      ? "active"
      : appConfig.signupsRequireApproval
        ? "pending_approval"
        : "active"
    : undefined;
  const initialTier = isNew
    ? options.invite?.tier === "pro"
      ? "pro"
      : "free"
    : undefined;

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({
        supabaseAuthUserId,
        email: profile.email ?? existing.email,
        firstName: profile.firstName ?? existing.firstName,
        lastName: profile.lastName ?? existing.lastName,
        profileImageUrl: profile.profileImageUrl ?? existing.profileImageUrl,
        ...(promoteToAdmin &&
        (existing.role !== "admin" || existing.status !== "active")
          ? { role: "admin", status: "active" }
          : {}),
        ...(options.invite
          ? { status: "active", tier: options.invite.tier === "pro" ? "pro" : "free" }
          : {}),
      })
      .where(eq(usersTable.id, existing.id))
      .returning();
    return {
      user: updated ?? existing,
      isNew,
      promotedToAdmin: promoteToAdmin,
    };
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      supabaseAuthUserId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImageUrl: profile.profileImageUrl,
      role: promoteToAdmin ? "admin" : "user",
      status: promoteToAdmin ? "active" : initialStatus ?? "pending_approval",
      tier: initialTier ?? "free",
    })
    .returning();

  return {
    user: created,
    isNew,
    promotedToAdmin: promoteToAdmin,
  };
}

export async function resolveInvite(
  token: string | undefined | null,
  email: string | null,
): Promise<InviteResolution> {
  if (!token || typeof token !== "string") return { invite: null };
  const [row] = await db
    .select()
    .from(userInvitesTable)
    .where(eq(userInvitesTable.token, token));
  if (!row) return { invite: null, error: "INVITE_INVALID" };
  if (row.revokedAt) return { invite: null, error: "INVITE_REVOKED" };
  if (row.consumedAt) {
    return { invite: row, error: "INVITE_CONSUMED" };
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { invite: row, error: "INVITE_EXPIRED" };
  }
  if (
    row.invitedEmail &&
    email &&
    row.invitedEmail.toLowerCase() !== email.toLowerCase()
  ) {
    return { invite: row, error: "INVITE_EMAIL_MISMATCH" };
  }
  return { invite: row };
}

export async function consumeInvite(token: string, userId: string) {
  const updated = await db
    .update(userInvitesTable)
    .set({ consumedAt: new Date(), consumedByUserId: userId })
    .where(
      sql`${userInvitesTable.token} = ${token} AND ${userInvitesTable.consumedAt} IS NULL AND ${userInvitesTable.revokedAt} IS NULL`,
    )
    .returning({ id: userInvitesTable.id });
  return updated.length > 0;
}

export async function finalizeInviteForUser(
  userId: string,
  email: string | null,
  inviteToken: string,
): Promise<InviteResolution> {
  const resolution = await resolveInvite(inviteToken, email);
  if (!resolution.invite) {
    return resolution;
  }

  if (resolution.error === "INVITE_CONSUMED") {
    if (resolution.invite.consumedByUserId === userId) {
      return { invite: resolution.invite };
    }
    return resolution;
  }
  if (resolution.error) {
    return resolution;
  }

  const won = await consumeInvite(resolution.invite.token, userId);
  if (!won) {
    return { invite: resolution.invite, error: "INVITE_CONSUMED" };
  }

  await db
    .update(usersTable)
    .set({
      status: "active",
      tier: resolution.invite.tier === "pro" ? "pro" : "free",
    })
    .where(eq(usersTable.id, userId));

  return { invite: resolution.invite };
}

export async function createImpersonation(
  adminUserId: string,
  targetUserId: string,
) {
  const token = crypto.randomBytes(32).toString("hex");
  await db
    .delete(adminImpersonationsTable)
    .where(eq(adminImpersonationsTable.adminUserId, adminUserId));
  await db.insert(adminImpersonationsTable).values({
    token,
    adminUserId,
    targetUserId,
    expiresAt: new Date(Date.now() + IMPERSONATION_TTL),
  });
  return token;
}

export async function clearImpersonation(
  adminUserId: string,
  token?: string | null,
) {
  if (token) {
    await db
      .delete(adminImpersonationsTable)
      .where(
        and(
          eq(adminImpersonationsTable.adminUserId, adminUserId),
          eq(adminImpersonationsTable.token, token),
        ),
      );
    return;
  }

  await db
    .delete(adminImpersonationsTable)
    .where(eq(adminImpersonationsTable.adminUserId, adminUserId));
}

export async function resolveImpersonation(
  adminUserId: string,
  token: string,
): Promise<ImpersonationData | null> {
  const [row] = await db
    .select({
      token: adminImpersonationsTable.token,
      targetUserId: adminImpersonationsTable.targetUserId,
      createdAt: adminImpersonationsTable.createdAt,
      expiresAt: adminImpersonationsTable.expiresAt,
      targetEmail: usersTable.email,
    })
    .from(adminImpersonationsTable)
    .innerJoin(
      usersTable,
      eq(adminImpersonationsTable.targetUserId, usersTable.id),
    )
    .where(
      and(
        eq(adminImpersonationsTable.adminUserId, adminUserId),
        eq(adminImpersonationsTable.token, token),
      ),
    );

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await clearImpersonation(adminUserId, token);
    return null;
  }

  return {
    targetUserId: row.targetUserId,
    targetEmail: row.targetEmail,
    startedAt: row.createdAt.getTime(),
  };
}

export async function getUserById(id: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user ?? null;
}

export async function getRealAndEffectiveUser(
  claims: SupabaseAuthClaims,
  impersonationToken?: string,
) {
  const provisioned = await upsertAppUserFromClaims(claims);
  const realUser = provisioned.user;

  if (realUser.role !== "admin" || !impersonationToken) {
    return { realUser, effectiveUser: realUser, impersonation: null };
  }

  const impersonation = await resolveImpersonation(realUser.id, impersonationToken);
  if (!impersonation) {
    return { realUser, effectiveUser: realUser, impersonation: null };
  }

  const targetUser = await getUserById(impersonation.targetUserId);
  if (!targetUser) {
    return { realUser, effectiveUser: realUser, impersonation: null };
  }

  return {
    realUser,
    effectiveUser: targetUser,
    impersonation,
  };
}
