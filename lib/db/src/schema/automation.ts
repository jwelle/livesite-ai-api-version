import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { demosTable } from "./demos";

export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    last4: varchar("last4", { length: 4 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("IDX_api_keys_user_id").on(table.userId),
    uniqueIndex("UQ_api_keys_key_hash").on(table.keyHash),
  ],
);

export const ghlConnectionsTable = pgTable(
  "ghl_connections",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    locationId: varchar("location_id", { length: 128 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    companyId: varchar("company_id", { length: 128 }),
    name: text("name").notNull(),
    authType: varchar("auth_type", { length: 64 }).notNull().default("private_integration_token"),
    encryptedAccessToken: text("encrypted_access_token"),
    tokenLast4: varchar("token_last4", { length: 4 }),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array(),
    defaultWritebackMode: varchar("default_writeback_mode", { length: 64 }).notNull().default("contact_note"),
    contactDemoUrlFieldId: varchar("contact_demo_url_field_id", { length: 128 }),
    opportunityDemoUrlFieldId: varchar("opportunity_demo_url_field_id", { length: 128 }),
    addNote: boolean("add_note").notNull().default(true),
    applyTag: boolean("apply_tag").notNull().default(false),
    successTagId: varchar("success_tag_id", { length: 128 }),
    successTagName: text("success_tag_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("IDX_ghl_connections_user_id").on(table.userId),
    index("IDX_ghl_connections_location_id").on(table.locationId),
  ],
);

export const demoRequestsTable = pgTable(
  "demo_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    source: varchar("source", { length: 64 }).notNull().default("api"),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    ghlConnectionId: varchar("ghl_connection_id").references(() => ghlConnectionsTable.id, { onDelete: "set null" }),
    locationId: varchar("location_id", { length: 128 }).notNull(),
    contactId: varchar("contact_id", { length: 128 }),
    opportunityId: varchar("opportunity_id", { length: 128 }),
    companyName: text("company_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: varchar("phone", { length: 50 }),
    industry: text("industry"),
    notes: text("notes"),
    rawPayload: jsonb("raw_payload"),
    status: varchar("status", { length: 64 }).notNull().default("queued"),
    demoId: varchar("demo_id").references(() => demosTable.id, { onDelete: "set null" }),
    publicUrl: text("public_url"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("IDX_demo_requests_user_id").on(table.userId),
    index("IDX_demo_requests_status").on(table.status),
  ],
);

export const ghlWritebackAttemptsTable = pgTable(
  "ghl_writeback_attempts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    demoRequestId: varchar("demo_request_id")
      .notNull()
      .references(() => demoRequestsTable.id, { onDelete: "cascade" }),
    demoId: varchar("demo_id").references(() => demosTable.id, { onDelete: "set null" }),
    ghlConnectionId: varchar("ghl_connection_id").references(() => ghlConnectionsTable.id, { onDelete: "set null" }),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: varchar("target_id", { length: 128 }),
    fieldId: varchar("field_id", { length: 128 }),
    status: varchar("status", { length: 64 }).notNull().default("pending"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),
    errorMessage: text("error_message"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("IDX_ghl_writeback_attempts_request").on(table.demoRequestId),
  ],
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type DemoRequest = typeof demoRequestsTable.$inferSelect;
export type GhlConnection = typeof ghlConnectionsTable.$inferSelect;
export type GhlWritebackAttempt = typeof ghlWritebackAttemptsTable.$inferSelect;
