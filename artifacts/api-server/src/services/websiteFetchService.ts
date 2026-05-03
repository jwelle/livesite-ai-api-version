import { parse } from "node-html-parser";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export type ExtractedContent = {
  title: string;
  metaDescription: string;
  headings: string[];
  text: string;
};

export class WebsiteFetchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 12_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; LiveSiteAI-Bot/1.0; +https://livesiteai.example)";

export function normalizeWebsiteUrl(input: string): string {
  if (!input || typeof input !== "string") {
    throw new WebsiteFetchError("INVALID_URL", "A website URL is required.");
  }
  let url = input.trim();
  if (!url) {
    throw new WebsiteFetchError("INVALID_URL", "A website URL is required.");
  }
  if (/^(javascript|data|file|ftp|gopher|mailto):/i.test(url)) {
    throw new WebsiteFetchError(
      "BLOCKED_PROTOCOL",
      "Only http and https URLs are allowed.",
    );
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebsiteFetchError("INVALID_URL", "That URL doesn't look valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new WebsiteFetchError(
      "BLOCKED_PROTOCOL",
      "Only http and https URLs are allowed.",
    );
  }
  const host = stripIpv6Brackets(parsed.hostname.toLowerCase());
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new WebsiteFetchError(
      "BLOCKED_HOST",
      "Internal hostnames are not allowed.",
    );
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new WebsiteFetchError(
      "BLOCKED_HOST",
      "Private IP addresses are not allowed.",
    );
  }
  return parsed.toString();
}

function stripIpv6Brackets(host: string): string {
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}

function expandIpv6(addr: string): number[] | null {
  // Strip optional zone id (e.g. fe80::1%eth0).
  const noZone = addr.split("%")[0]!;
  // Convert any embedded IPv4 dotted suffix into two hextets.
  let s = noZone;
  const dotted = s.match(/(.*:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) {
    const head = dotted[1]!;
    const v4 = dotted[2]!.split(".").map((p) => Number(p));
    if (v4.length !== 4 || v4.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
    const hi = ((v4[0]! << 8) | v4[1]!).toString(16);
    const lo = ((v4[2]! << 8) | v4[3]!).toString(16);
    s = `${head}${hi}:${lo}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - (left.length + right.length);
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && missing < 0) return null;
  const middle = halves.length === 2 ? new Array(missing).fill("0") : [];
  const parts = [...left, ...middle, ...right];
  if (parts.length !== 8) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(p)) return null;
    out.push(parseInt(p, 16));
  }
  return out;
}

function isPrivateIp(rawIp: string): boolean {
  const ip = stripIpv6Brackets(rawIp);
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    // Expand to 8 hextets and check whether the address embeds an IPv4 address
    // in its low 32 bits (covers ::ffff:a.b.c.d, ::ffff:hex:hex, ::a.b.c.d,
    // and bare hex forms like ::7f00:1 / ::c0a8:101).
    const hextets = expandIpv6(lower);
    if (hextets) {
      const high96AllZero = hextets.slice(0, 6).every((h) => h === 0);
      const isV4Mapped = hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff;
      if (high96AllZero || isV4Mapped) {
        const hi = hextets[6]!;
        const lo = hextets[7]!;
        const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateIp(dotted);
      }
    }
    return false;
  }
  // Unknown / unparseable — treat as unsafe.
  return true;
}

async function resolveHostnameSafe(rawHostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = stripIpv6Brackets(rawHostname);
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new WebsiteFetchError(
        "BLOCKED_HOST",
        "Private IP addresses are not allowed.",
      );
    }
    return { address: hostname, family: net.isIPv6(hostname) ? 6 : 4 };
  }
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new WebsiteFetchError(
      "DNS_ERROR",
      "We couldn't resolve that domain. Please check the URL and try again.",
    );
  }
  if (!records || records.length === 0) {
    throw new WebsiteFetchError(
      "DNS_ERROR",
      "We couldn't resolve that domain. Please check the URL and try again.",
    );
  }
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new WebsiteFetchError(
        "BLOCKED_HOST",
        "This hostname resolves to a private network and is blocked.",
      );
    }
  }
  // Prefer IPv4 to keep the connect path simple; all records are public per the loop above.
  const v4 = records.find((r) => r.family === 4) ?? records[0]!;
  return { address: v4.address, family: (v4.family === 6 ? 6 : 4) };
}

function makePinnedAgent(pinnedIp: string): Agent {
  // Pin every DNS lookup performed by this dispatcher to the validated IP.
  // This prevents DNS rebinding / TOCTOU between our pre-check and connect time.
  return new Agent({
    connect: {
      lookup: (
        _hostname: string,
        _opts: unknown,
        cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ) => {
        cb(null, pinnedIp, net.isIPv6(pinnedIp) ? 6 : 4);
      },
    },
    headersTimeout: FETCH_TIMEOUT_MS,
    bodyTimeout: FETCH_TIMEOUT_MS,
  });
}

const MAX_REDIRECTS = 5;

export async function fetchWebsiteHtml(rawUrl: string): Promise<{ url: string; html: string }> {
  const initialUrl = normalizeWebsiteUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = initialUrl;
    let res: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = new URL(currentUrl);
      // Re-validate every hop (initial + each redirect target).
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new WebsiteFetchError("BLOCKED_PROTOCOL", "Only http and https URLs are allowed.");
      }
      const resolved = await resolveHostnameSafe(parsed.hostname);
      const dispatcher = makePinnedAgent(resolved.address);

      let next: Response;
      try {
        next = (await undiciFetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          dispatcher,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        })) as unknown as Response;
      } catch (err) {
        const e = err as { name?: string; message?: string };
        if (e?.name === "AbortError") {
          throw new WebsiteFetchError(
            "TIMEOUT",
            "We couldn't reach this website in time. You can still complete the demo manually.",
          );
        }
        throw new WebsiteFetchError(
          "FETCH_FAILED",
          "We couldn't reach this website. You can still complete the demo manually.",
        );
      }

      if (next.status >= 300 && next.status < 400) {
        const loc = next.headers.get("location");
        try { await next.body?.cancel(); } catch { /* ignore */ }
        if (!loc) {
          throw new WebsiteFetchError("HTTP_ERROR", "This website redirected without a target.");
        }
        if (hop === MAX_REDIRECTS) {
          throw new WebsiteFetchError("TOO_MANY_REDIRECTS", "This website has too many redirects.");
        }
        const nextUrl = new URL(loc, currentUrl).toString();
        currentUrl = normalizeWebsiteUrl(nextUrl);
        continue;
      }

      res = next;
      break;
    }

    if (!res) {
      throw new WebsiteFetchError("FETCH_FAILED", "We couldn't reach this website.");
    }

    if (!res.ok) {
      throw new WebsiteFetchError(
        "HTTP_ERROR",
        `This website returned an error (status ${res.status}). Try entering the business details manually.`,
      );
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct && !ct.includes("text/html") && !ct.includes("application/xhtml") && !ct.includes("text/plain")) {
      throw new WebsiteFetchError(
        "NON_HTML",
        "That URL didn't return a web page we could read.",
      );
    }

    // Stream-cap to MAX_BYTES; abort timer remains active through body read.
    const reader = res.body?.getReader();
    if (!reader) {
      throw new WebsiteFetchError("FETCH_FAILED", "We couldn't read the website response.");
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_BYTES) {
            chunks.push(value.slice(0, Math.max(0, MAX_BYTES - (received - value.byteLength))));
            try { await reader.cancel(); } catch { /* ignore */ }
            break;
          }
          chunks.push(value);
        }
      }
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === "AbortError") {
        throw new WebsiteFetchError(
          "TIMEOUT",
          "We couldn't read this website in time. You can still complete the demo manually.",
        );
      }
      throw new WebsiteFetchError("FETCH_FAILED", "We couldn't read the website response.");
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const html = buf.toString("utf8");
    return { url: currentUrl, html };
  } finally {
    clearTimeout(timer);
  }
}

export function extractWebsiteContent(html: string): ExtractedContent {
  const root = parse(html, {
    blockTextElements: { script: false, noscript: false, style: false, pre: true },
  });

  const titleEl = root.querySelector("title");
  const title = (titleEl?.text || "").trim().slice(0, 300);

  const metaDescEl =
    root.querySelector('meta[name="description"]') ||
    root.querySelector('meta[property="og:description"]');
  const metaDescription = (metaDescEl?.getAttribute("content") || "").trim().slice(0, 600);

  const headings: string[] = [];
  for (const sel of ["h1", "h2", "h3"]) {
    for (const el of root.querySelectorAll(sel)) {
      const t = el.text.replace(/\s+/g, " ").trim();
      if (t && t.length <= 200 && !headings.includes(t)) headings.push(t);
      if (headings.length >= 40) break;
    }
    if (headings.length >= 40) break;
  }

  for (const sel of ["script", "style", "noscript", "iframe", "svg", "nav", "footer", "header"]) {
    for (const el of root.querySelectorAll(sel)) el.remove();
  }
  const bodyText = root.text.replace(/\s+/g, " ").trim();
  const text = bodyText.slice(0, MAX_TEXT_CHARS);

  return { title, metaDescription, headings, text };
}
