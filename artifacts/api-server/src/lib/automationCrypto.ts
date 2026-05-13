import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_BYTES = 32;

function parseEncryptionKey(): Buffer {
  const raw = process.env.AUTOMATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "AUTOMATION_TOKEN_ENCRYPTION_KEY is required to store private integration tokens.",
    );
  }

  const hexCandidate = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : null;
  if (hexCandidate && hexCandidate.length === KEY_BYTES) {
    return hexCandidate;
  }

  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const base64Candidate = Buffer.from(`${normalized}${padding}`, "base64");
  if (base64Candidate.length === KEY_BYTES) {
    return base64Candidate;
  }

  throw new Error(
    "AUTOMATION_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64/base64url or 64 hex characters.",
  );
}

export function encryptAutomationToken(value: string): string {
  const key = parseEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptAutomationToken(payload: string): string {
  const [version, ivPart, tagPart, cipherPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !cipherPart) {
    throw new Error("Unsupported encrypted token payload.");
  }

  const key = parseEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherPart, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
