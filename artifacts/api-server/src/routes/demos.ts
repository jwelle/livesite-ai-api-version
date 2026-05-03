import { Router } from "express";
import { db, demosTable, agencySettingsTable, promptVersionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateDemoBody,
  UpdateDemoBody,
  GetDemoParams,
  UpdateDemoParams,
  DeleteDemoParams,
  RegenerateDemoSlugParams,
  EnrichBusinessBody,
  EnrichDemoParams,
  RegenerateDemoPromptParams,
  LogDemoCopyEventParams,
  ExportDemoMarkdownParams,
  ExportDemoJsonParams,
  PushDemoToGhlParams,
} from "@workspace/api-zod";
import {
  runEnrichment,
  isOpenAIConfigured,
  buildFinalPrompt,
  type EnrichInput,
  type BusinessProfile,
  type VoiceAgentPackage,
} from "../services/enrichmentService";
import { seedIfEmpty } from "../services/seed";
import { blockDuringImpersonation } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

const router = Router();

const blockMutateForImpersonation = blockDuringImpersonation;

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

function sanitizeWidgetId(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(normalizeUrl(value));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Per-user rate limiter for enrichment / regenerate.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const arr = rateBuckets.get(userId) ?? [];
  const recent = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(userId, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(userId, recent);
  return true;
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

router.post("/demos", blockMutateForImpersonation, async (req, res) => {
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
  const chatWidgetId = sanitizeWidgetId(
    data.chatWidgetId || settings?.defaultGhlWidgetId || null,
  );
  const chatPersonaName =
    data.chatPersonaName || settings?.defaultChatPersonaName || null;
  const voicePersonaName =
    data.voicePersonaName || settings?.defaultVoicePersonaName || null;
  const desiredTone = data.desiredTone || settings?.defaultTone || null;
  const primaryCta = data.primaryCta || settings?.defaultPrimaryCta || null;

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
      desiredTone,
      primaryCta,
      optionalNotes: data.optionalNotes ?? null,
      ghlVoiceAgentId: sanitizeWidgetId(data.ghlVoiceAgentId ?? null),
      ctaCalendarLink,
      chatWidgetId,
      chatPersonaName,
      companyDescription: data.companyDescription ?? null,
      servicesOffered: data.servicesOffered ?? null,
      serviceArea: data.serviceArea ?? null,
      customDemoMessage: data.customDemoMessage ?? null,
      internalNotes: data.internalNotes ?? null,
      status: data.status ?? "draft",
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
  const isRealAdmin = req.realUser?.role === "admin" && !req.impersonation;
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(
      isRealAdmin
        ? eq(demosTable.id, params.data.id)
        : and(
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

router.patch("/demos/:id", blockMutateForImpersonation, async (req, res) => {
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
  if (data.desiredTone !== undefined) updates.desiredTone = data.desiredTone;
  if (data.primaryCta !== undefined) updates.primaryCta = data.primaryCta;
  if (data.optionalNotes !== undefined) updates.optionalNotes = data.optionalNotes;
  if (data.ghlVoiceAgentId !== undefined)
    updates.ghlVoiceAgentId = sanitizeWidgetId(data.ghlVoiceAgentId);
  if (data.ctaCalendarLink !== undefined) updates.ctaCalendarLink = data.ctaCalendarLink;
  if (data.chatWidgetId !== undefined) updates.chatWidgetId = sanitizeWidgetId(data.chatWidgetId);
  if (data.chatPersonaName !== undefined) updates.chatPersonaName = data.chatPersonaName;
  if (data.companyDescription !== undefined) updates.companyDescription = data.companyDescription;
  if (data.servicesOffered !== undefined) updates.servicesOffered = data.servicesOffered;
  if (data.serviceArea !== undefined) updates.serviceArea = data.serviceArea;
  if (data.customDemoMessage !== undefined) updates.customDemoMessage = data.customDemoMessage;
  if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes;
  if (data.businessProfile !== undefined) updates.businessProfile = data.businessProfile;
  if (data.voiceAgentPackage !== undefined) updates.voiceAgentPackage = data.voiceAgentPackage;
  // Editing the prompt updates ONLY currentWorkingPrompt — never aiGeneratedPrompt.
  if (data.currentWorkingPrompt !== undefined) {
    updates.currentWorkingPrompt = data.currentWorkingPrompt;
  }
  if (data.finalSavedPrompt !== undefined) {
    updates.finalSavedPrompt = data.finalSavedPrompt;
  }
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

  // Track prompt history when working prompt or final prompt changes.
  if (data.currentWorkingPrompt && typeof data.currentWorkingPrompt === "string") {
    await db.insert(promptVersionsTable).values({
      demoId: demo.id,
      type: "user_edited",
      promptText: data.currentWorkingPrompt,
    });
  }
  if (data.finalSavedPrompt && typeof data.finalSavedPrompt === "string") {
    await db.insert(promptVersionsTable).values({
      demoId: demo.id,
      type: "final_saved",
      promptText: data.finalSavedPrompt,
    });
  }

  res.json(demo);
});

router.delete("/demos/:id", blockMutateForImpersonation, async (req, res) => {
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

router.post("/demos/:id/regenerate-slug", blockMutateForImpersonation, async (req, res) => {
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

// ---- OpenAI status ----
router.get("/openai-status", (_req, res) => {
  res.json({ configured: isOpenAIConfigured() });
});

// ---- Enrichment (no save) ----
router.post("/enrich-business", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!isOpenAIConfigured()) {
    res.status(500).json({ error: "OpenAI is not configured on the server." });
    return;
  }
  const parsed = EnrichBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!isValidHttpUrl(parsed.data.websiteUrl)) {
    res.status(400).json({ error: "Website URL must be a valid http(s) URL." });
    return;
  }
  if (!checkRateLimit(req.user.id)) {
    res.status(429).json({ error: "Too many enrichment requests. Please wait a minute and try again." });
    return;
  }
  const input: EnrichInput = {
    businessName: parsed.data.businessName,
    websiteUrl: normalizeUrl(parsed.data.websiteUrl),
    industry: parsed.data.industry ?? null,
    agentGoal: parsed.data.agentGoal,
    tone: parsed.data.tone ?? null,
    primaryCta: parsed.data.primaryCta ?? null,
    optionalNotes: parsed.data.optionalNotes ?? null,
  };
  try {
    const result = await runEnrichment(input);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "enrich-business failed");
    res.status(500).json({ error: "AI enrichment failed. Please try again or enter business details manually." });
  }
});

// ---- Enrich a saved demo ----
router.post("/demos/:id/enrich", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!isOpenAIConfigured()) {
    res.status(500).json({ error: "OpenAI is not configured on the server." });
    return;
  }
  const params = EnrichDemoParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!checkRateLimit(req.user.id)) {
    res.status(429).json({ error: "Too many enrichment requests. Please wait a minute and try again." });
    return;
  }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  if (!demo.voiceAiGoal) {
    res.status(400).json({ error: "Voice Agent Goal is required before enrichment." });
    return;
  }
  const [settings] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.userId, req.user.id));
  const input: EnrichInput = {
    businessName: demo.companyName,
    websiteUrl: demo.websiteUrl,
    industry: demo.industry,
    agentGoal: demo.voiceAiGoal,
    tone: demo.desiredTone,
    primaryCta: demo.primaryCta,
    optionalNotes: demo.optionalNotes,
    disclaimer: settings?.defaultDisclaimer || null,
  };
  try {
    const result = await runEnrichment(input);
    const [updated] = await db
      .update(demosTable)
      .set({
        businessProfile: result.businessProfile,
        voiceAgentPackage: result.voiceAgentPackage,
        aiGeneratedPrompt: result.aiGeneratedPrompt,
        currentWorkingPrompt: result.aiGeneratedPrompt,
        status: "enriched",
      })
      .where(eq(demosTable.id, demo.id))
      .returning();
    await db.insert(promptVersionsTable).values({
      demoId: demo.id,
      type: "ai_generated",
      promptText: result.aiGeneratedPrompt,
      notes: result.limitedResults ? "Limited public information found." : null,
    });
    res.json(updated);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "enrich-demo failed");
    await db.update(demosTable).set({ status: "failed" }).where(eq(demosTable.id, demo.id));
    res.status(500).json({ error: "AI enrichment failed. Please try again or enter business details manually." });
  }
});

// ---- Regenerate prompt only ----
router.post("/demos/:id/regenerate", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!isOpenAIConfigured()) {
    res.status(500).json({ error: "OpenAI is not configured on the server." });
    return;
  }
  const params = RegenerateDemoPromptParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!checkRateLimit(req.user.id)) {
    res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
    return;
  }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  if (!demo.voiceAiGoal) {
    res.status(400).json({ error: "Voice Agent Goal is required before regeneration." });
    return;
  }
  const [regenSettings] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.userId, req.user.id));
  const disclaimer = regenSettings?.defaultDisclaimer || null;
  try {
    let aiGeneratedPrompt: string;
    if (demo.businessProfile && demo.voiceAgentPackage) {
      // Regenerate prompt from existing structured data without re-enriching.
      aiGeneratedPrompt = buildFinalPrompt(
        demo.businessProfile as unknown as BusinessProfile,
        demo.voiceAgentPackage as unknown as VoiceAgentPackage,
        {
          businessName: demo.companyName,
          websiteUrl: demo.websiteUrl,
          industry: demo.industry,
          agentGoal: demo.voiceAiGoal,
          tone: demo.desiredTone,
          primaryCta: demo.primaryCta,
          optionalNotes: demo.optionalNotes,
          disclaimer,
        },
      );
    } else {
      const input: EnrichInput = {
        businessName: demo.companyName,
        websiteUrl: demo.websiteUrl,
        industry: demo.industry,
        agentGoal: demo.voiceAiGoal,
        tone: demo.desiredTone,
        primaryCta: demo.primaryCta,
        optionalNotes: demo.optionalNotes,
        disclaimer,
      };
      const result = await runEnrichment(input);
      aiGeneratedPrompt = result.aiGeneratedPrompt;
      await db.update(demosTable).set({
        businessProfile: result.businessProfile,
        voiceAgentPackage: result.voiceAgentPackage,
      }).where(eq(demosTable.id, demo.id));
    }
    // Save the new AI-generated prompt; preserve currentWorkingPrompt as-is.
    const [updated] = await db
      .update(demosTable)
      .set({ aiGeneratedPrompt })
      .where(eq(demosTable.id, demo.id))
      .returning();
    await db.insert(promptVersionsTable).values({
      demoId: demo.id,
      type: "regenerated",
      promptText: aiGeneratedPrompt,
    });
    res.json(updated);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "regenerate failed");
    res.status(500).json({ error: "Regenerate failed. Please try again." });
  }
});

router.post("/demos/:id/copy-event", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = LogDemoCopyEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  const newStatus = demo.status === "approved" || demo.status === "edited" || demo.status === "enriched"
    ? "copied"
    : demo.status;
  const [updated] = await db
    .update(demosTable)
    .set({ status: newStatus })
    .where(eq(demosTable.id, demo.id))
    .returning();
  res.json(updated);
});

router.post("/demos/:id/export-markdown", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = ExportDemoMarkdownParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  const text = demo.currentWorkingPrompt || demo.aiGeneratedPrompt || "";
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${demo.slug}-prompt.md"`,
  );
  res.send(text);
});

router.post("/demos/:id/export-json", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = ExportDemoJsonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  const payload = {
    businessProfile: demo.businessProfile,
    voiceAgentPackage: demo.voiceAgentPackage,
    aiGeneratedPrompt: demo.aiGeneratedPrompt,
    currentWorkingPrompt: demo.currentWorkingPrompt,
    finalSavedPrompt: demo.finalSavedPrompt,
  };
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${demo.slug}-export.json"`,
  );
  res.json(payload);
});

router.post("/demos/:id/push-ghl", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = PushDemoToGhlParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  // V1 placeholder — GHL push API not configured. When a real push integration
  // is wired in, set `success` to true on success and the demo status will
  // advance to `pushed_to_ghl`.
  const success = false as boolean;
  const message = success
    ? "Pushed to GHL."
    : "GHL push is not configured yet. You can copy the final prompt and paste it into your voice agent manually.";
  if (success) {
    await db
      .update(demosTable)
      .set({ status: "pushed_to_ghl" })
      .where(eq(demosTable.id, demo.id));
  }
  res.json({ success, message });
});

router.get("/demos/:id/prompt-versions", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = req.params.id;
  if (!id || typeof id !== "string") { res.status(400).json({ error: "Invalid ID" }); return; }
  const [demo] = await db
    .select({ id: demosTable.id })
    .from(demosTable)
    .where(and(eq(demosTable.id, id), eq(demosTable.userId, req.user.id)));
  if (!demo) { res.status(404).json({ error: "Demo not found" }); return; }
  const versions = await db
    .select()
    .from(promptVersionsTable)
    .where(eq(promptVersionsTable.demoId, id));
  versions.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  res.json(versions);
});

export default router;
