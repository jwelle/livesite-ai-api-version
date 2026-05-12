import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  agencySettingsTable,
  apiKeysTable,
  db,
  demoRequestsTable,
  demosTable,
  promptVersionsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { blockDuringImpersonation, requireActiveUser } from "../middlewares/authMiddleware";
import {
  isOpenAIConfigured,
  runEnrichment,
  type EnrichInput,
} from "../services/enrichmentService";

const router = Router();

const createApiKeyBody = z.object({
  name: z.string().trim().min(1).max(120).default("Default API key"),
});

const demoRequestBody = z.object({
  companyName: z.string().trim().min(1),
  websiteUrl: z.string().trim().min(1),
  locationId: z.string().trim().min(1).optional(),
  contactId: z.string().trim().min(1).optional(),
  opportunityId: z.string().trim().min(1).optional(),
  contactName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(1).optional(),
  industry: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  rawPayload: z.unknown().optional(),
  source: z.string().trim().min(1).max(64).optional(),
  options: z.object({
    enrich: z.boolean().optional(),
  }).optional(),
});

function hashKey(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createPlaintextKey(): string {
  return `lsi_${crypto.randomBytes(32).toString("base64url")}`;
}

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(normalizeUrl(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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

async function getUniqueSlug(base: string): Promise<string> {
  const slug = slugify(base) || "demo";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${shortId()}`;
    const existing = await db
      .select({ id: demosTable.id })
      .from(demosTable)
      .where(eq(demosTable.slug, candidate));
    if (existing.length === 0) return candidate;
  }
  return `${slug}-${crypto.randomBytes(3).toString("hex")}`;
}

function baseUrlFromRequest(req: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function serializeApiKey(row: typeof apiKeysTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    last4: row.last4,
    maskedKey: `${row.keyPrefix}...${row.last4}`,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

async function authenticateApiKey(req: Request, res: Response) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const apiKey = bearer || String(req.headers["x-api-key"] || "").trim();
  if (!apiKey) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "API key is required." });
    return null;
  }

  const keyHash = hashKey(apiKey);
  const [row] = await db
    .select({ key: apiKeysTable, user: usersTable })
    .from(apiKeysTable)
    .innerJoin(usersTable, eq(apiKeysTable.userId, usersTable.id))
    .where(and(eq(apiKeysTable.keyHash, keyHash), isNull(apiKeysTable.revokedAt)));

  if (!row || row.user.status !== "active") {
    res.status(401).json({ error: "UNAUTHORIZED", message: "API key is invalid or inactive." });
    return null;
  }

  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, row.key.id));

  return row.user;
}

async function updateRequestStatus(
  id: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  const [updated] = await db
    .update(demoRequestsTable)
    .set({
      ...extra,
      status,
      lastAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(demoRequestsTable.id, id))
    .returning();
  return updated;
}

router.post("/v1/api-keys", requireActiveUser, blockDuringImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const parsed = createApiKeyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const plaintextKey = createPlaintextKey();
  const [created] = await db
    .insert(apiKeysTable)
    .values({
      userId: req.user.id,
      name: parsed.data.name,
      keyHash: hashKey(plaintextKey),
      keyPrefix: plaintextKey.slice(0, 8),
      last4: plaintextKey.slice(-4),
    })
    .returning();

  res.status(201).json({
    apiKey: serializeApiKey(created),
    plaintextKey,
  });
});

router.get("/v1/api-keys", requireActiveUser, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const keys = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, req.user.id));
  res.json({ items: keys.map(serializeApiKey) });
});

router.post("/v1/api-keys/:id/revoke", requireActiveUser, blockDuringImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const id = String(req.params.id ?? "");
  const [updated] = await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, req.user.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "NOT_FOUND", message: "API key not found." });
    return;
  }
  res.json({ apiKey: serializeApiKey(updated) });
});

router.get("/v1/demo-requests", requireActiveUser, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const items = await db
    .select()
    .from(demoRequestsTable)
    .where(eq(demoRequestsTable.userId, req.user.id));
  res.json({ items });
});

router.get("/v1/demo-requests/:id", requireActiveUser, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }
  const id = String(req.params.id ?? "");
  const [item] = await db
    .select()
    .from(demoRequestsTable)
    .where(and(eq(demoRequestsTable.id, id), eq(demoRequestsTable.userId, req.user.id)));
  if (!item) {
    res.status(404).json({ error: "NOT_FOUND", message: "Demo request not found." });
    return;
  }
  res.json(item);
});

router.post("/v1/demo-requests", async (req, res) => {
  const user = await authenticateApiKey(req, res);
  if (!user) return;

  const parsed = demoRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }
  const data = parsed.data;
  if (!isValidHttpUrl(data.websiteUrl)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "websiteUrl must be a valid http(s) URL." });
    return;
  }

  const locationId = data.locationId ?? "external-api";
  const websiteUrl = normalizeUrl(data.websiteUrl);
  const shouldEnrich = data.options?.enrich ?? isOpenAIConfigured();

  const [requestRow] = await db
    .insert(demoRequestsTable)
    .values({
      userId: user.id,
      source: data.source ?? "api",
      locationId,
      contactId: data.contactId ?? null,
      opportunityId: data.opportunityId ?? null,
      companyName: data.companyName,
      websiteUrl,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      industry: data.industry ?? null,
      notes: data.notes ?? null,
      rawPayload: data.rawPayload ?? req.body,
      status: "queued",
    })
    .returning();

  try {
    await updateRequestStatus(requestRow.id, "creating_demo");
    const [settings] = await db
      .select()
      .from(agencySettingsTable)
      .where(eq(agencySettingsTable.userId, user.id));
    const slug = await getUniqueSlug(data.companyName);
    const [demo] = await db
      .insert(demosTable)
      .values({
        userId: user.id,
        companyName: data.companyName,
        slug,
        websiteUrl,
        industry: data.industry ?? null,
        contactName: data.contactName ?? null,
        contactEmail: data.email ?? null,
        contactPhone: data.phone ?? null,
        voiceAiPhoneNumber: settings?.defaultVoiceAiPhone ?? "+1-555-555-5555",
        voicePersonaName: settings?.defaultVoicePersonaName ?? null,
        voiceAiGoal: data.notes ?? "Answer questions and capture qualified lead details.",
        desiredTone: settings?.defaultTone ?? "Friendly, professional, helpful",
        primaryCta: settings?.defaultPrimaryCta ?? "Book a consultation",
        optionalNotes: data.notes ?? null,
        ctaCalendarLink: settings?.defaultCalendarLink ?? "https://calendly.com/",
        chatWidgetId: settings?.defaultGhlWidgetId ?? null,
        chatPersonaName: settings?.defaultChatPersonaName ?? null,
        status: "draft",
      })
      .returning();

    const publicUrl = `${baseUrlFromRequest(req)}/demo/${demo.slug}`;
    await updateRequestStatus(requestRow.id, shouldEnrich ? "enriching" : "publishing", {
      demoId: demo.id,
      publicUrl,
    });

    if (shouldEnrich) {
      const input: EnrichInput = {
        businessName: demo.companyName,
        websiteUrl: demo.websiteUrl,
        industry: demo.industry,
        agentGoal: demo.voiceAiGoal ?? "Answer questions and capture qualified lead details.",
        tone: demo.desiredTone,
        primaryCta: demo.primaryCta,
        optionalNotes: demo.optionalNotes,
        disclaimer: settings?.defaultDisclaimer ?? null,
      };
      const result = await runEnrichment(input);
      await db
        .update(demosTable)
        .set({
          businessProfile: result.businessProfile,
          voiceAgentPackage: result.voiceAgentPackage,
          aiGeneratedPrompt: result.aiGeneratedPrompt,
          currentWorkingPrompt: result.aiGeneratedPrompt,
          status: "enriched",
        })
        .where(eq(demosTable.id, demo.id));
      await db.insert(promptVersionsTable).values({
        demoId: demo.id,
        type: "ai_generated",
        promptText: result.aiGeneratedPrompt,
        notes: result.limitedResults ? "Limited public information found." : null,
      });
      await updateRequestStatus(requestRow.id, "publishing");
    }

    const [published] = await db
      .update(demosTable)
      .set({ status: "active" })
      .where(eq(demosTable.id, demo.id))
      .returning();
    const completed = await updateRequestStatus(requestRow.id, "completed", {
      demoId: demo.id,
      publicUrl,
      errorMessage: null,
    });

    res.status(201).json({
      demoRequest: completed,
      demo: published,
      publicUrl,
    });
  } catch (err) {
    const message = (err as Error).message || "Demo request processing failed.";
    const failed = await updateRequestStatus(requestRow.id, "failed", {
      errorMessage: message,
      retryCount: sql`${demoRequestsTable.retryCount} + 1`,
    });
    res.status(500).json({
      error: "DEMO_REQUEST_FAILED",
      message,
      demoRequest: failed,
    });
  }
});

export default router;
