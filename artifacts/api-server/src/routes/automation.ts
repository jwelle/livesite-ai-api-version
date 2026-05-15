import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  agencySettingsTable,
  apiKeysTable,
  db,
  demoRequestsTable,
  demosTable,
  ghlConnectionsTable,
  ghlWritebackAttemptsTable,
  promptVersionsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { blockDuringImpersonation, requireActiveUser } from "../middlewares/authMiddleware";
import { encryptAutomationToken } from "../lib/automationCrypto";
import { config } from "../lib/config";
import { checkCanCreateDemo } from "../services/usageService";
import {
  runEnrichment,
  type EnrichInput,
} from "../services/enrichmentService";
import { resolveDemoRequestRoute, type DemoRequestAuth } from "./automationRouting";

const router = Router();

const createApiKeyBody = z.object({
  name: z.string().trim().min(1).max(120).default("Default API key"),
});

const createGhlConnectionBody = z.object({
  name: z.string().trim().min(1).max(120),
  locationId: z.string().trim().min(1).max(128),
  companyId: z.string().trim().min(1).max(128).optional(),
  privateIntegrationToken: z.string().trim().min(1),
  authType: z.literal("private_integration_token").optional(),
  scopes: z.array(z.string().trim().min(1)).optional(),
  defaultWritebackMode: z.string().trim().min(1).max(64).optional(),
  contactDemoUrlFieldId: z.string().trim().min(1).max(128).optional(),
  opportunityDemoUrlFieldId: z.string().trim().min(1).max(128).optional(),
  addNote: z.boolean().optional(),
  applyTag: z.boolean().optional(),
  successTagId: z.string().trim().min(1).max(128).optional(),
  successTagName: z.string().trim().min(1).optional(),
});

const demoRequestBody = z.object({
  companyName: z.string().trim().min(1).optional(),
  prospectName: z.string().trim().min(1).optional(),
  websiteUrl: z.string().trim().min(1),
  locationId: z.string().trim().min(1).max(128).optional(),
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
}).superRefine((data, ctx) => {
  if (!data.companyName && !data.prospectName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["companyName"],
      message: "companyName or prospectName is required.",
    });
  }
});

const createWritebackBody = z.object({
  demoRequestId: z.string().trim().min(1),
  demoId: z.string().trim().min(1).optional(),
  ghlConnectionId: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1).max(64),
  targetId: z.string().trim().min(1).max(128).optional(),
  fieldId: z.string().trim().min(1).max(128).optional(),
  status: z.enum(["pending", "success", "failed"]).optional(),
  requestMetadata: z.unknown().optional(),
  responseMetadata: z.unknown().optional(),
  errorMessage: z.string().trim().min(1).optional(),
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

function isLocalBaseUrl(value: string): boolean {
  try {
    const host = new URL(normalizeUrl(value)).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
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
  if (configured && (process.env.NODE_ENV !== "production" || !isLocalBaseUrl(configured))) {
    return normalizeUrl(configured).replace(/\/+$/, "");
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (process.env.NODE_ENV === "production" && vercelProductionUrl) {
    return normalizeUrl(vercelProductionUrl).replace(/\/+$/, "");
  }

  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function demoGateUrl(req: Request, slug: string): string {
  return `${baseUrlFromRequest(req)}/demo/${slug}`;
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

function serializeGhlConnection(row: typeof ghlConnectionsTable.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    locationId: row.locationId,
    isActive: row.isActive,
    companyId: row.companyId,
    name: row.name,
    authType: row.authType,
    tokenLast4: row.tokenLast4,
    tokenMasked: row.tokenLast4 ? `****${row.tokenLast4}` : null,
    tokenExpiresAt: row.tokenExpiresAt,
    scopes: row.scopes ?? [],
    defaultWritebackMode: row.defaultWritebackMode,
    contactDemoUrlFieldId: row.contactDemoUrlFieldId,
    opportunityDemoUrlFieldId: row.opportunityDemoUrlFieldId,
    addNote: row.addNote,
    applyTag: row.applyTag,
    successTagId: row.successTagId,
    successTagName: row.successTagName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeWriteback(row: typeof ghlWritebackAttemptsTable.$inferSelect) {
  return {
    id: row.id,
    demoRequestId: row.demoRequestId,
    demoId: row.demoId,
    ghlConnectionId: row.ghlConnectionId,
    targetType: row.targetType,
    targetId: row.targetId,
    fieldId: row.fieldId,
    status: row.status,
    requestMetadata: row.requestPayload,
    responseMetadata: row.responsePayload,
    errorMessage: row.errorMessage,
    attemptedAt: row.attemptedAt,
    createdAt: row.createdAt,
  };
}

type DemoRequestApiAuth =
  | {
      kind: "user_api_key";
      key: typeof apiKeysTable.$inferSelect;
      user: typeof usersTable.$inferSelect;
    }
  | {
      kind: "shared_api_key";
      key: null;
      user: null;
    };

function matchesSharedApiKey(apiKey: string): boolean {
  if (config.automationSharedApiKeys.length === 0) return false;
  const providedHash = hashKey(apiKey);
  return config.automationSharedApiKeys.some((sharedKey) => hashKey(sharedKey) === providedHash);
}

async function authenticateApiKey(req: Request, res: Response): Promise<DemoRequestApiAuth | null> {
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
    if (!matchesSharedApiKey(apiKey)) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "API key is invalid or inactive." });
      return null;
    }

    return {
      kind: "shared_api_key",
      key: null,
      user: null,
    };
  }

  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, row.key.id));

  return {
    kind: "user_api_key",
    key: row.key,
    user: row.user,
  };
}

async function resolveGhlConnectionForDemoRequest(auth: DemoRequestApiAuth, locationId: string | undefined) {
  if (!locationId) {
    const result = resolveDemoRequestRoute({
      auth: auth.kind === "user_api_key"
        ? { kind: "user_api_key", userId: auth.user.id }
        : { kind: "shared_api_key" },
      locationId,
      connections: [],
      usersById: new Map(),
    });
    return {
      connection: null,
      ownerUser: null,
      error: result.ok ? null : result,
    };
  }

  const connections = await db
    .select()
    .from(ghlConnectionsTable)
    .where(eq(ghlConnectionsTable.locationId, locationId));

  const userIds = Array.from(new Set(connections.map((connection) => connection.userId)));
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const routingAuth: DemoRequestAuth = auth.kind === "user_api_key"
    ? { kind: "user_api_key", userId: auth.user.id }
    : { kind: "shared_api_key" };
  const result = resolveDemoRequestRoute({
    auth: routingAuth,
    locationId,
    connections,
    usersById,
  });

  if (!result.ok) {
    return {
      connection: null,
      ownerUser: null,
      error: result,
    };
  }

  return {
    connection: result.connection,
    ownerUser: result.ownerUser,
    error: null,
  };
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

router.get("/v1/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "automation-api",
    version: "v1",
  });
});

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
  const auth = await authenticateApiKey(req, res);
  if (!auth) return;

  const parsed = demoRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const companyName = data.companyName ?? data.prospectName;
  if (!companyName) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "companyName or prospectName is required." });
    return;
  }
  if (!isValidHttpUrl(data.websiteUrl)) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "websiteUrl must be a valid http(s) URL." });
    return;
  }

  const locationId = data.locationId;
  const websiteUrl = normalizeUrl(data.websiteUrl);
  const shouldEnrich = data.options?.enrich === true;
  const connectionResolution = await resolveGhlConnectionForDemoRequest(auth, locationId);
  if (connectionResolution.error) {
    res.status(connectionResolution.error.status).json({
      error: connectionResolution.error.code,
      message: connectionResolution.error.message,
    });
    return;
  }
  const ghlConnection = connectionResolution.connection;
  const ownerUser = connectionResolution.ownerUser;

  if (!ownerUser || !ghlConnection) {
    res.status(403).json({ error: "GHL_LOCATION_NOT_FOUND", message: "No active GHL connection found for this locationId." });
    return;
  }

  const allowed = await checkCanCreateDemo(ownerUser, res);
  if (!allowed) return;

  const [requestRow] = await db
    .insert(demoRequestsTable)
    .values({
      userId: ownerUser.id,
      source: data.source ?? "api",
      ghlConnectionId: ghlConnection.id,
      locationId: locationId!,
      contactId: data.contactId ?? null,
      opportunityId: data.opportunityId ?? null,
      companyName,
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
      .where(eq(agencySettingsTable.userId, ownerUser.id));
    const slug = await getUniqueSlug(companyName);
    const [demo] = await db
      .insert(demosTable)
      .values({
        userId: ownerUser.id,
        createdVia: "api",
        externalSource: data.source ?? "api",
        apiKeyId: auth.key?.id ?? null,
        externalSourceId: data.opportunityId ?? data.contactId ?? null,
        locationId: locationId!,
        companyName,
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

    const publicUrl = demoGateUrl(req, demo.slug);
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
      success: true,
      demoId: published.id,
      demoUrl: publicUrl,
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

router.get("/v1/ghl-connections", requireActiveUser, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  const items = await db
    .select()
    .from(ghlConnectionsTable)
    .where(eq(ghlConnectionsTable.userId, req.user.id))
    .orderBy(desc(ghlConnectionsTable.createdAt));

  res.json({ items: items.map(serializeGhlConnection) });
});

router.post("/v1/ghl-connections", requireActiveUser, blockDuringImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  const parsed = createGhlConnectionBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [created] = await db
    .insert(ghlConnectionsTable)
    .values({
      userId: req.user.id,
      locationId: data.locationId,
      companyId: data.companyId ?? null,
      name: data.name,
      authType: data.authType ?? "private_integration_token",
      encryptedAccessToken: encryptAutomationToken(data.privateIntegrationToken),
      tokenLast4: data.privateIntegrationToken.slice(-4),
      scopes: data.scopes ?? [],
      defaultWritebackMode: data.defaultWritebackMode ?? "contact_note",
      contactDemoUrlFieldId: data.contactDemoUrlFieldId ?? null,
      opportunityDemoUrlFieldId: data.opportunityDemoUrlFieldId ?? null,
      addNote: data.addNote ?? true,
      applyTag: data.applyTag ?? false,
      successTagId: data.successTagId ?? null,
      successTagName: data.successTagName ?? null,
    })
    .returning();

  res.status(201).json({ connection: serializeGhlConnection(created) });
});

router.delete("/v1/ghl-connections/:id", requireActiveUser, blockDuringImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  const id = String(req.params.id ?? "");
  const [deleted] = await db
    .delete(ghlConnectionsTable)
    .where(and(eq(ghlConnectionsTable.id, id), eq(ghlConnectionsTable.userId, req.user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "NOT_FOUND", message: "GHL connection not found." });
    return;
  }

  res.json({ success: true, connection: serializeGhlConnection(deleted) });
});

router.get("/v1/writebacks", requireActiveUser, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  const demoRequestId = typeof req.query.demoRequestId === "string" ? req.query.demoRequestId.trim() : "";
  const requestRows = await db
    .select({ id: demoRequestsTable.id })
    .from(demoRequestsTable)
    .where(
      demoRequestId
        ? and(eq(demoRequestsTable.userId, req.user.id), eq(demoRequestsTable.id, demoRequestId))
        : eq(demoRequestsTable.userId, req.user.id),
    );

  const requestIds = requestRows.map((row) => row.id);
  if (requestIds.length === 0) {
    res.json({ items: [] });
    return;
  }

  const items = await db
    .select()
    .from(ghlWritebackAttemptsTable)
    .where(inArray(ghlWritebackAttemptsTable.demoRequestId, requestIds))
    .orderBy(desc(ghlWritebackAttemptsTable.attemptedAt));

  res.json({ items: items.map(serializeWriteback) });
});

router.post("/v1/writebacks", requireActiveUser, blockDuringImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Unauthorized" });
    return;
  }

  const parsed = createWritebackBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [requestRow] = await db
    .select()
    .from(demoRequestsTable)
    .where(and(eq(demoRequestsTable.id, data.demoRequestId), eq(demoRequestsTable.userId, req.user.id)));
  if (!requestRow) {
    res.status(404).json({ error: "NOT_FOUND", message: "Demo request not found." });
    return;
  }

  if (data.demoId) {
    const [demo] = await db
      .select({ id: demosTable.id })
      .from(demosTable)
      .where(and(eq(demosTable.id, data.demoId), eq(demosTable.userId, req.user.id)));
    if (!demo) {
      res.status(404).json({ error: "NOT_FOUND", message: "Demo not found." });
      return;
    }
  }

  if (data.ghlConnectionId) {
    const [connection] = await db
      .select({ id: ghlConnectionsTable.id })
      .from(ghlConnectionsTable)
      .where(and(eq(ghlConnectionsTable.id, data.ghlConnectionId), eq(ghlConnectionsTable.userId, req.user.id)));
    if (!connection) {
      res.status(404).json({ error: "NOT_FOUND", message: "GHL connection not found." });
      return;
    }
  }

  const [created] = await db
    .insert(ghlWritebackAttemptsTable)
    .values({
      demoRequestId: data.demoRequestId,
      demoId: data.demoId ?? requestRow.demoId ?? null,
      ghlConnectionId: data.ghlConnectionId ?? requestRow.ghlConnectionId ?? null,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      fieldId: data.fieldId ?? null,
      status: data.status ?? "pending",
      requestPayload: data.requestMetadata ?? null,
      responsePayload: data.responseMetadata ?? null,
      errorMessage: data.errorMessage ?? null,
    })
    .returning();

  res.status(201).json({ writeback: serializeWriteback(created) });
});

export default router;
