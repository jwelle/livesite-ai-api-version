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
  AnalyzeDemoWebsiteParams,
  AnalyzeDemoWebsiteBody,
  ApplyDemoWebsiteIntelligenceParams,
  ApplyDemoWebsiteIntelligenceBody,
} from "@workspace/api-zod";
import { seedIfEmpty } from "../services/seed";
import { blockDuringImpersonation } from "../middlewares/authMiddleware";
import {
  fetchWebsiteHtml,
  extractWebsiteContent,
  WebsiteFetchError,
} from "../services/websiteFetchService";
import { analyzeWebsiteBasic } from "../services/basicWebsiteAnalysisService";
import {
  analyzeWebsiteWithOpenAI,
  isOpenAiConfigured,
} from "../services/openAiWebsiteAnalysisService";

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
  if (data.ctaCalendarLink !== undefined) updates.ctaCalendarLink = data.ctaCalendarLink;
  if (data.chatWidgetId !== undefined) updates.chatWidgetId = sanitizeWidgetId(data.chatWidgetId);
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

router.post("/demos/:id/analyze-website", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }
  const params = AnalyzeDemoWebsiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID", code: "INVALID_URL" });
    return;
  }
  // Body is currently empty/optional — OpenAI use is controlled exclusively by
  // the agency's persisted setting + server-side key presence.
  AnalyzeDemoWebsiteBody.safeParse(req.body ?? {});

  const userId = req.user.id;
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, userId)));
  if (!demo) {
    res.status(404).json({ error: "Demo not found", code: "INVALID_URL" });
    return;
  }

  const [settings] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.userId, userId));

  const targetUrl = demo.websiteUrl;
  if (!targetUrl) {
    res.status(400).json({ error: "Demo has no websiteUrl to analyze.", code: "INVALID_URL" });
    return;
  }

  let fetched: { url: string; html: string };
  try {
    fetched = await fetchWebsiteHtml(targetUrl);
  } catch (err) {
    if (err instanceof WebsiteFetchError) {
      await db
        .update(demosTable)
        .set({
          websiteAnalysisStatus: "failed",
          websiteAnalysisError: err.message,
          websiteAnalyzedAt: new Date(),
        })
        .where(eq(demosTable.id, demo.id));
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({
      error: "Unexpected error fetching the website.",
      code: "FETCH_FAILED",
    });
    return;
  }

  const content = extractWebsiteContent(fetched.html);
  const analysisInput = {
    url: fetched.url,
    companyName: demo.companyName,
    industry: demo.industry,
    title: content.title,
    metaDescription: content.metaDescription,
    headings: content.headings,
    text: content.text,
  };

  const wantOpenAi = Boolean(settings?.enableOpenAiWebsiteIntelligence);

  const warnings: string[] = [];
  let source: "openai" | "basic" = "basic";
  let analysis;

  if (wantOpenAi && isOpenAiConfigured()) {
    try {
      analysis = await analyzeWebsiteWithOpenAI(analysisInput);
      source = "openai";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OpenAI analysis failed";
      warnings.push(`OpenAI analysis unavailable — used the basic parser instead. (${msg.slice(0, 200)})`);
      analysis = analyzeWebsiteBasic(analysisInput);
      source = "basic";
    }
  } else {
    if (wantOpenAi && !isOpenAiConfigured()) {
      warnings.push("OpenAI is not configured on the server — used the basic parser instead.");
    }
    analysis = analyzeWebsiteBasic(analysisInput);
    source = "basic";
  }

  const status = analysis.missing_information.length > 0 ? "partial" : "ok";

  const [updated] = await db
    .update(demosTable)
    .set({
      websiteTitle: content.title || null,
      websiteMetaDescription: content.metaDescription || null,
      websiteHeadings: content.headings,
      websiteRawTextExcerpt: content.text || null,
      extractedBusinessSummary: analysis.company_summary || null,
      extractedServices: analysis.likely_services,
      extractedServiceArea: analysis.service_area || null,
      extractedFaqs: analysis.suggested_faqs,
      extractedTone: analysis.business_tone || null,
      extractedTargetCustomers: analysis.target_customers || null,
      suggestedChatPersona: analysis.suggested_chat_persona || null,
      suggestedVoicePersona: analysis.suggested_voice_persona || null,
      suggestedLeadQuestions: analysis.suggested_lead_questions,
      generatedChatContext: analysis.generated_chat_context,
      generatedVoicePrompt: analysis.generated_voice_prompt,
      missingInformation: analysis.missing_information,
      websiteAnalysisStatus: status,
      websiteAnalysisError: null,
      websiteAnalyzedAt: new Date(),
      websiteAnalysisSource: source,
    })
    .where(eq(demosTable.id, demo.id))
    .returning();

  res.json({ demo: updated, source, warnings });
});

router.post("/demos/:id/apply-website-intelligence", blockMutateForImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = ApplyDemoWebsiteIntelligenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const body = ApplyDemoWebsiteIntelligenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [demo] = await db
    .select()
    .from(demosTable)
    .where(and(eq(demosTable.id, params.data.id), eq(demosTable.userId, req.user.id)));
  if (!demo) {
    res.status(404).json({ error: "Demo not found" });
    return;
  }

  const services = Array.isArray(demo.extractedServices)
    ? (demo.extractedServices as unknown[]).map(String)
    : [];
  const updates: Record<string, unknown> = {};
  for (const field of body.data.fields) {
    switch (field) {
      case "companyDescription":
        if (demo.extractedBusinessSummary) updates.companyDescription = demo.extractedBusinessSummary;
        break;
      case "servicesOffered":
        if (services.length > 0) updates.servicesOffered = services.join(", ");
        break;
      case "serviceArea":
        if (demo.extractedServiceArea && demo.extractedServiceArea !== "Unknown") {
          updates.serviceArea = demo.extractedServiceArea;
        }
        break;
      case "chatPersonaName":
        if (demo.suggestedChatPersona) updates.chatPersonaName = demo.suggestedChatPersona;
        break;
      case "voicePersonaName":
        if (demo.suggestedVoicePersona) updates.voicePersonaName = demo.suggestedVoicePersona;
        break;
      case "voiceAiGoal":
        if (demo.generatedVoicePrompt) updates.voiceAiGoal = demo.generatedVoicePrompt;
        break;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.json(demo);
    return;
  }

  const [updated] = await db
    .update(demosTable)
    .set(updates)
    .where(eq(demosTable.id, demo.id))
    .returning();
  res.json(updated);
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

export default router;
