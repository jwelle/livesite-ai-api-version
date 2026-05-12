import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
  text,
} from "drizzle-orm/pg-core";

// Legacy browser-session storage from the Replit OIDC implementation.
// It is kept for backwards-compatibility while Supabase Auth rolls out.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// status: "pending_approval" | "active" | "suspended"
// tier: "free" | "pro"
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supabaseAuthUserId: varchar("supabase_auth_user_id").unique(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  status: varchar("status", { length: 32 }).notNull().default("pending_approval"),
  tier: varchar("tier", { length: 20 }).notNull().default("free"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;

export const adminAuditLogTable = pgTable(
  "admin_audit_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    actorId: varchar("actor_id").notNull(),
    actorEmail: varchar("actor_email"),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }),
    targetId: varchar("target_id"),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("IDX_admin_audit_log_created_at").on(table.createdAt)],
);

export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;

export const userInvitesTable = pgTable(
  "user_invites",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    token: varchar("token", { length: 64 }).notNull().unique(),
    tier: varchar("tier", { length: 20 }).notNull().default("free"),
    invitedEmail: varchar("invited_email"),
    note: text("note"),
    createdBy: varchar("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: varchar("consumed_by_user_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("IDX_user_invites_created_at").on(table.createdAt)],
);

export type UserInvite = typeof userInvitesTable.$inferSelect;
export type InsertUserInvite = typeof userInvitesTable.$inferInsert;

export const adminImpersonationsTable = pgTable(
  "admin_impersonations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    token: varchar("token", { length: 128 }).notNull().unique(),
    adminUserId: varchar("admin_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    targetUserId: varchar("target_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("IDX_admin_impersonations_admin").on(table.adminUserId),
    index("IDX_admin_impersonations_expires_at").on(table.expiresAt),
  ],
);

export type AdminImpersonation = typeof adminImpersonationsTable.$inferSelect;

export const dailyUsageTable = pgTable(
  "daily_usage",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    usageDate: date("usage_date").notNull(),
    enrichmentCount: integer("enrichment_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("UQ_daily_usage_user_date").on(table.userId, table.usageDate),
  ],
);

export type DailyUsage = typeof dailyUsageTable.$inferSelect;
