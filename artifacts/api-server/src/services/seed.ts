import { db, demosTable, agencySettingsTable } from "@workspace/db";
import { count } from "drizzle-orm";

const FALLBACK_WIDGET_ID = "69c5a088532eaeb30be7c36d";

export async function seedIfEmpty(userId: string): Promise<void> {
  const [result] = await db.select({ count: count() }).from(demosTable);
  if (result && result.count > 0) return;

  await db.insert(demosTable).values({
    userId,
    companyName: "Shoreline Roofing",
    slug: "shoreline-roofing",
    websiteUrl: "https://example.com",
    industry: "Roofing",
    chatPersonaName: "Roofing Demo Assistant",
    chatWidgetId: FALLBACK_WIDGET_ID,
    voicePersonaName: "Roofing AI Receptionist",
    voiceAiPhoneNumber: "+1-555-555-5555",
    ctaCalendarLink: "https://calendly.com/",
    status: "active",
  });
}
