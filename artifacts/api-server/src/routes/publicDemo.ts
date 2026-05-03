import { Router } from "express";
import { db, demosTable, agencySettingsTable, demoEventsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  TrackDemoViewParams,
  TrackDemoCallClickParams,
  TrackDemoCalendarClickParams,
  TrackDemoWebsiteOpenClickParams,
  GetPublicDemoParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router = Router();

const FALLBACK_WIDGET_ID = "69c5a088532eaeb30be7c36d";

async function getDemoBySlug(slug: string) {
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(eq(demosTable.slug, slug));
  return demo ?? null;
}

async function resolveWidgetId(demo: typeof demosTable.$inferSelect): Promise<{ widgetId: string; source: "demo_override" | "global_default" | "hardcoded_fallback" }> {
  if (demo.chatWidgetId) {
    return { widgetId: demo.chatWidgetId, source: "demo_override" };
  }
  const [settings] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.userId, demo.userId));
  if (settings?.defaultGhlWidgetId) {
    return { widgetId: settings.defaultGhlWidgetId, source: "global_default" };
  }
  return { widgetId: FALLBACK_WIDGET_ID, source: "hardcoded_fallback" };
}

async function trackEvent(
  demoId: string,
  eventType: string,
  req: import("express").Request,
) {
  await db.insert(demoEventsTable).values({
    demoId,
    eventType,
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null,
    userAgent: req.headers["user-agent"] || null,
  });
}

router.get("/public/demo/:slug", async (req, res) => {
  const params = GetPublicDemoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const demo = await getDemoBySlug(params.data.slug);
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  const [owner] = await db
    .select({ status: usersTable.status })
    .from(usersTable)
    .where(eq(usersTable.id, demo.userId));
  if (owner?.status === "suspended") {
    res.status(410).json({ error: "This demo is unavailable." });
    return;
  }
  const { widgetId, source } = await resolveWidgetId(demo);
  res.json({
    id: demo.id,
    companyName: demo.companyName,
    slug: demo.slug,
    websiteUrl: demo.websiteUrl,
    industry: demo.industry,
    voiceAiPhoneNumber: demo.voiceAiPhoneNumber,
    voicePersonaName: demo.voicePersonaName,
    ctaCalendarLink: demo.ctaCalendarLink,
    chatPersonaName: demo.chatPersonaName,
    customDemoMessage: demo.customDemoMessage,
    status: demo.status,
    resolvedChatWidgetId: widgetId,
    widgetSource: source,
  });
});

router.post("/public/demo/:slug/view", async (req, res) => {
  const params = TrackDemoViewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const demo = await getDemoBySlug(params.data.slug);
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  await Promise.all([
    db
      .update(demosTable)
      .set({ viewCount: sql`${demosTable.viewCount} + 1` })
      .where(eq(demosTable.id, demo.id)),
    trackEvent(demo.id, "view", req),
  ]);
  res.json({ success: true });
});

router.post("/public/demo/:slug/call-click", async (req, res) => {
  const params = TrackDemoCallClickParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const demo = await getDemoBySlug(params.data.slug);
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  await Promise.all([
    db
      .update(demosTable)
      .set({ callClickCount: sql`${demosTable.callClickCount} + 1` })
      .where(eq(demosTable.id, demo.id)),
    trackEvent(demo.id, "call_click", req),
  ]);
  res.json({ success: true });
});

router.post("/public/demo/:slug/calendar-click", async (req, res) => {
  const params = TrackDemoCalendarClickParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const demo = await getDemoBySlug(params.data.slug);
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  await Promise.all([
    db
      .update(demosTable)
      .set({ calendarClickCount: sql`${demosTable.calendarClickCount} + 1` })
      .where(eq(demosTable.id, demo.id)),
    trackEvent(demo.id, "calendar_click", req),
  ]);
  res.json({ success: true });
});

router.post("/public/demo/:slug/website-open-click", async (req, res) => {
  const params = TrackDemoWebsiteOpenClickParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const demo = await getDemoBySlug(params.data.slug);
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  await trackEvent(demo.id, "website_open_click", req);
  res.json({ success: true });
});

export default router;
