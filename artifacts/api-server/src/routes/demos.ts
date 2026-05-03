import { Router } from "express";
import { db, demosTable, agencySettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateDemoBody,
  UpdateDemoBody,
  GetDemoParams,
  UpdateDemoParams,
  DeleteDemoParams,
  RegenerateDemoSlugParams,
} from "@workspace/api-zod";
import { generateVoiceAIPrompt } from "../services/aiPromptService";
import { seedIfEmpty } from "../services/seed";

const router = Router();

const FALLBACK_WIDGET_ID = "69c5a088532eaeb30be7c36d";
const DEFAULT_VOICE_PHONE = "+1-555-555-5555";
const DEFAULT_CALENDAR_LINK = "https://calendly.com/";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function getUniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${shortId()}`;
    const existing = await db
      .select({ id: demosTable.id })
      .from(demosTable)
      .where(eq(demosTable.slug, candidate));
    if (
      existing.length === 0 ||
      (excludeId && existing.length === 1 && existing[0]!.id === excludeId)
    ) {
      return candidate;
    }
    attempt++;
    if (attempt > 10) return `${slug}-${shortId()}`;
  }
}

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

router.get("/demos", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  await seedIfEmpty(userId);
  const demos = await db
    .select()
    .from(demosTable)
    .where(eq(demosTable.userId, userId))
    .orderBy(demosTable.createdAt);
  res.json(demos);
});

router.post("/demos", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateDemoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const data = parsed.data;

  const [settings] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.userId, userId));

  const slug = await getUniqueSlug(data.companyName);
  const websiteUrl = normalizeUrl(data.websiteUrl);
  const voiceAiPhoneNumber =
    data.voiceAiPhoneNumber ||
    settings?.defaultVoiceAiPhone ||
    DEFAULT_VOICE_PHONE;
  const ctaCalendarLink =
    data.ctaCalendarLink ||
    settings?.defaultCalendarLink ||
    DEFAULT_CALENDAR_LINK;
  const chatWidgetId =
    data.chatWidgetId || settings?.defaultGhlWidgetId || null;
  const chatPersonaName =
    data.chatPersonaName || settings?.defaultChatPersonaName || null;
  const voicePersonaName =
    data.voicePersonaName || settings?.defaultVoicePersonaName || null;

  const [demo] = await db
    .insert(demosTable)
    .values({
      userId,
      companyName: data.companyName,
      slug,
      websiteUrl,
      industry: data.industry ?? null,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      voiceAiPhoneNumber,
      voicePersonaName,
      voiceAiGoal: data.voiceAiGoal ?? null,
      ctaCalendarLink,
      chatWidgetId,
      chatPersonaName,
      companyDescription: data.companyDescription ?? null,
      servicesOffered: data.servicesOffered ?? null,
      serviceArea: data.serviceArea ?? null,
      customDemoMessage: data.customDemoMessage ?? null,
      internalNotes: data.internalNotes ?? null,
      status: data.status ?? "active",
    })
    .returning();

  res.status(201).json(demo);
});

router.get("/demos/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = GetDemoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(
      and(
        eq(demosTable.id, params.data.id),
        eq(demosTable.userId, req.user.id),
      ),
    );
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  res.json(demo);
});

router.patch("/demos/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = UpdateDemoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateDemoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const updates: Record<string, unknown> = {};

  if (data.companyName !== undefined) updates.companyName = data.companyName;
  if (data.websiteUrl !== undefined)
    updates.websiteUrl = data.websiteUrl ? normalizeUrl(data.websiteUrl) : data.websiteUrl;
  if (data.industry !== undefined) updates.industry = data.industry;
  if (data.contactName !== undefined) updates.contactName = data.contactName;
  if (data.contactEmail !== undefined) updates.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) updates.contactPhone = data.contactPhone;
  if (data.voiceAiPhoneNumber !== undefined) updates.voiceAiPhoneNumber = data.voiceAiPhoneNumber;
  if (data.voicePersonaName !== undefined) updates.voicePersonaName = data.voicePersonaName;
  if (data.voiceAiGoal !== undefined) updates.voiceAiGoal = data.voiceAiGoal;
  if (data.ctaCalendarLink !== undefined) updates.ctaCalendarLink = data.ctaCalendarLink;
  if (data.chatWidgetId !== undefined) updates.chatWidgetId = data.chatWidgetId;
  if (data.chatPersonaName !== undefined) updates.chatPersonaName = data.chatPersonaName;
  if (data.companyDescription !== undefined) updates.companyDescription = data.companyDescription;
  if (data.servicesOffered !== undefined) updates.servicesOffered = data.servicesOffered;
  if (data.serviceArea !== undefined) updates.serviceArea = data.serviceArea;
  if (data.customDemoMessage !== undefined) updates.customDemoMessage = data.customDemoMessage;
  if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes;
  if (data.status !== undefined) updates.status = data.status;

  const [demo] = await db
    .update(demosTable)
    .set(updates)
    .where(
      and(
        eq(demosTable.id, params.data.id),
        eq(demosTable.userId, req.user.id),
      ),
    )
    .returning();

  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  res.json(demo);
});

router.delete("/demos/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = DeleteDemoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(demosTable)
    .where(
      and(
        eq(demosTable.id, params.data.id),
        eq(demosTable.userId, req.user.id),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  res.json({ success: true });
});

router.post("/demos/:id/regenerate-slug", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = RegenerateDemoSlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [existing] = await db
    .select()
    .from(demosTable)
    .where(
      and(
        eq(demosTable.id, params.data.id),
        eq(demosTable.userId, req.user.id),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }
  const newSlug = await getUniqueSlug(
    `${existing.companyName}-${shortId()}`,
    existing.id,
  );
  const [demo] = await db
    .update(demosTable)
    .set({ slug: newSlug })
    .where(eq(demosTable.id, params.data.id))
    .returning();
  res.json(demo);
});

router.get("/dashboard/stats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const demos = await db
    .select()
    .from(demosTable)
    .where(eq(demosTable.userId, userId));

  const totalDemos = demos.length;
  const activeDemos = demos.filter((d) => d.status === "active").length;
  const totalViews = demos.reduce((sum, d) => sum + (d.viewCount ?? 0), 0);
  const totalCallClicks = demos.reduce(
    (sum, d) => sum + (d.callClickCount ?? 0),
    0,
  );
  const totalCalendarClicks = demos.reduce(
    (sum, d) => sum + (d.calendarClickCount ?? 0),
    0,
  );

  res.json({
    totalDemos,
    activeDemos,
    totalViews,
    totalCallClicks,
    totalCalendarClicks,
  });
});

export default router;
