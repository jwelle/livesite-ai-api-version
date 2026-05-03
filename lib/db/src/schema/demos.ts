import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const agencySettingsTable = pgTable("agency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  agencyName: text("agency_name"),
  agencyWebsite: text("agency_website"),
  agencyLogoUrl: text("agency_logo_url"),
  primaryBrandColor: varchar("primary_brand_color", { length: 20 }),
  secondaryBrandColor: varchar("secondary_brand_color", { length: 20 }),
  defaultVoiceAiPhone: varchar("default_voice_ai_phone", { length: 50 }),
  defaultVoicePersonaName: text("default_voice_persona_name"),
  defaultCalendarLink: text("default_calendar_link"),
  defaultGhlWidgetId: varchar("default_ghl_widget_id", { length: 100 }),
  defaultChatPersonaName: text("default_chat_persona_name"),
  enableOpenAiWebsiteIntelligence: boolean("enable_openai_website_intelligence").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AgencySettings = typeof agencySettingsTable.$inferSelect;
export type InsertAgencySettings = typeof agencySettingsTable.$inferInsert;

export const demosTable = pgTable("demos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  websiteUrl: text("website_url").notNull(),
  industry: text("industry"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: varchar("contact_phone", { length: 50 }),
  voiceAiPhoneNumber: varchar("voice_ai_phone_number", { length: 50 }),
  voicePersonaName: text("voice_persona_name"),
  voiceAiGoal: text("voice_ai_goal"),
  ctaCalendarLink: text("cta_calendar_link"),
  chatWidgetId: varchar("chat_widget_id", { length: 100 }),
  chatPersonaName: text("chat_persona_name"),
  companyDescription: text("company_description"),
  servicesOffered: text("services_offered"),
  serviceArea: text("service_area"),
  customDemoMessage: text("custom_demo_message"),
  internalNotes: text("internal_notes"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  viewCount: integer("view_count").notNull().default(0),
  callClickCount: integer("call_click_count").notNull().default(0),
  calendarClickCount: integer("calendar_click_count").notNull().default(0),
  websiteTitle: text("website_title"),
  websiteMetaDescription: text("website_meta_description"),
  websiteHeadings: jsonb("website_headings"),
  websiteRawTextExcerpt: text("website_raw_text_excerpt"),
  extractedBusinessSummary: text("extracted_business_summary"),
  extractedServices: jsonb("extracted_services"),
  extractedServiceArea: text("extracted_service_area"),
  extractedFaqs: jsonb("extracted_faqs"),
  extractedTone: text("extracted_tone"),
  extractedTargetCustomers: text("extracted_target_customers"),
  suggestedChatPersona: text("suggested_chat_persona"),
  suggestedVoicePersona: text("suggested_voice_persona"),
  suggestedLeadQuestions: jsonb("suggested_lead_questions"),
  generatedChatContext: text("generated_chat_context"),
  generatedVoicePrompt: text("generated_voice_prompt"),
  missingInformation: jsonb("missing_information"),
  websiteAnalysisStatus: varchar("website_analysis_status", { length: 30 }).notNull().default("not_started"),
  websiteAnalysisError: text("website_analysis_error"),
  websiteAnalyzedAt: timestamp("website_analyzed_at", { withTimezone: true }),
  websiteAnalysisSource: varchar("website_analysis_source", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("IDX_demos_user_id").on(table.userId),
  index("IDX_demos_slug").on(table.slug),
]);

export const insertDemoSchema = createInsertSchema(demosTable).omit({ id: true, viewCount: true, callClickCount: true, calendarClickCount: true, createdAt: true, updatedAt: true });
export type Demo = typeof demosTable.$inferSelect;
export type InsertDemo = z.infer<typeof insertDemoSchema>;

export const demoEventsTable = pgTable("demo_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  demoId: varchar("demo_id").notNull().references(() => demosTable.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventData: text("event_data"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_demo_events_demo_id").on(table.demoId),
]);

export type DemoEvent = typeof demoEventsTable.$inferSelect;
export type InsertDemoEvent = typeof demoEventsTable.$inferInsert;
