import { Router, type Request } from "express";

const router = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return (
    compact.includes("password") ||
    compact.includes("token") ||
    compact.includes("accesstoken") ||
    compact.includes("refreshtoken") ||
    compact.includes("apikey") ||
    compact.includes("secret") ||
    compact.includes("authorization") ||
    compact.includes("cookie")
  );
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function headerPreview(value: string): string {
  return value.length > 200 ? `${value.slice(0, 200)}...` : value;
}

function authorizationScheme(req: Request): string | null {
  const header = req.get("authorization");
  if (!header) return null;
  const [scheme] = header.trim().split(/\s+/);
  return scheme || null;
}

function safeSelectedHeaders(req: Request): Record<string, string> {
  const selected: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(req.headers)) {
    const normalized = key.toLowerCase();
    const isSelected =
      normalized === "x-livesite-test-source" ||
      normalized.startsWith("x-zapier-") ||
      normalized.startsWith("x-ghl-");

    if (!isSelected || isSensitiveKey(normalized)) continue;

    const value = firstHeaderValue(rawValue);
    if (value) {
      selected[normalized] = headerPreview(value);
    }
  }

  return selected;
}

function safeBodyValue(body: unknown, key: string): string | undefined {
  if (!isRecord(body)) return undefined;
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

router.post("/v1/external-test", (req, res) => {
  const configuredSecret = process.env.EXTERNAL_TEST_SECRET;
  if (!configuredSecret) {
    res.status(500).json({
      error: "EXTERNAL_TEST_NOT_CONFIGURED",
      message: "External test endpoint is not configured.",
    });
    return;
  }

  const providedSecret = req.get("x-livesite-test-secret");
  if (!providedSecret || providedSecret !== configuredSecret) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid external test secret.",
    });
    return;
  }

  const bodyKeys = isRecord(req.body)
    ? Object.keys(req.body).filter((key) => !isSensitiveKey(key))
    : [];

  const contactEmail = safeBodyValue(req.body, "contactEmail");

  res.json({
    ok: true,
    service: "automation-api",
    endpoint: "external-test",
    method: req.method,
    receivedAt: new Date().toISOString(),
    headers: {
      contentType: req.get("content-type") ?? null,
      userAgent: req.get("user-agent") ?? null,
      authorizationPresent: Boolean(req.get("authorization")),
      authorizationScheme: authorizationScheme(req),
      xApiKeyPresent: Boolean(req.get("x-api-key")),
      testSecretPresent: Boolean(providedSecret),
      selected: safeSelectedHeaders(req),
    },
    bodyKeys,
    source: safeBodyValue(req.body, "source") ?? null,
    testName: safeBodyValue(req.body, "testName") ?? null,
    ...(contactEmail ? { contactEmail } : {}),
  });
});

export default router;
