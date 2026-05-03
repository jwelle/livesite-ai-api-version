import OpenAI from "openai";

// Lightweight runtime validator for the OpenAI enrichment response.
// We intentionally avoid a hard schema rejection because LLM JSON sometimes
// omits or renames optional fields; validateEnrichmentShape returns true when
// the top-level structure looks usable, false otherwise. The downstream
// normalizers (normalizeProfile / normalizePackage) safely coerce missing or
// malformed fields to defaults.
function validateEnrichmentShape(value: unknown): value is {
  businessProfile?: Record<string, unknown>;
  voiceAgentPackage?: Record<string, unknown>;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const profileOk = v.businessProfile === undefined || (typeof v.businessProfile === "object" && v.businessProfile !== null);
  const packageOk = v.voiceAgentPackage === undefined || (typeof v.voiceAgentPackage === "object" && v.voiceAgentPackage !== null);
  return profileOk && packageOk;
}

const SYSTEM_INSTRUCTION = `You are an expert AI voice-agent architect for local businesses, sales teams, and marketing agencies.

Your job is to research the business using web search and generate a complete voice-agent prompt package for GoHighLevel or a similar AI voice platform.

Use web search as the source of truth.

Research the public web presence for the business using:
- Business name
- Website URL
- Industry/category
- Optional user notes

Find and extract:
- Business summary
- Core services
- Service area
- Phone number
- Business hours
- Customer types
- Differentiators
- Common customer questions
- Publicly visible offers or CTAs
- Relevant source URLs

Then create a voice-agent package that includes:
- Agent name
- Agent role
- Opening script
- Qualification questions
- Service explanation rules
- Objection handlers
- Booking or lead-capture instructions
- Escalation rules
- Compliance boundaries
- Final system prompt

Rules:
- Do not invent prices, guarantees, credentials, licenses, business hours, discounts, service areas, or availability.
- If something is not found, return "unknown".
- If a fact is uncertain, include it in the unknowns array or mark it as low confidence.
- Keep the final prompt suitable for pasting into a GHL voice-agent instruction field.
- The voice agent should identify itself as an AI assistant if asked.
- The voice agent should ask one question at a time.
- The voice agent should escalate to a human for sensitive, uncertain, or out-of-scope questions.
- The tone should match the requested tone from the user.
- Return structured JSON only, matching exactly the schema provided. No prose.`;

export interface EnrichInput {
  businessName: string;
  websiteUrl: string;
  industry?: string | null;
  agentGoal: string;
  tone?: string | null;
  primaryCta?: string | null;
  optionalNotes?: string | null;
}

export interface BusinessProfile {
  businessName: string;
  websiteUrl: string;
  industry: string;
  summary: string;
  services: string[];
  serviceArea: string;
  phone: string;
  hours: string;
  differentiators: string[];
  customerTypes: string[];
  commonQuestions: string[];
  sourceNotes: { title: string; url: string; note: string }[];
  unknowns: string[];
}

export interface VoiceAgentPackage {
  agentName: string;
  agentRole: string;
  tone: string;
  conversationGoal: string;
  openingScript: string;
  qualificationQuestions: string[];
  objectionHandlers: { objection: string; response: string }[];
  escalationRules: string[];
  bookingInstructions: string;
  complianceBoundaries: string[];
}

export interface EnrichmentResult {
  businessProfile: BusinessProfile;
  voiceAgentPackage: VoiceAgentPackage;
  aiGeneratedPrompt: string;
  limitedResults: boolean;
}

function buildUserPrompt(input: EnrichInput): string {
  return `Research this business and generate a complete voice-agent prompt package.

Business Name: ${input.businessName}
Website URL: ${input.websiteUrl}
Industry: ${input.industry || "(not specified)"}
Voice Agent Goal: ${input.agentGoal}
Desired Tone: ${input.tone || "Friendly, professional, helpful"}
Primary CTA: ${input.primaryCta || "Book a consultation"}
Optional Notes: ${input.optionalNotes || "(none)"}

Use the web_search tool to look up the business by name and website URL. Inspect publicly available pages (homepage, services, about, contact, hours, FAQs, reviews) and ground every fact in what you actually find. If a fact cannot be confirmed from the web, leave it as "unknown" or list it under unknowns.

Return JSON only matching this exact shape:
{
  "businessProfile": {
    "businessName": string,
    "websiteUrl": string,
    "industry": string,
    "summary": string,
    "services": string[],
    "serviceArea": string,
    "phone": string,
    "hours": string,
    "differentiators": string[],
    "customerTypes": string[],
    "commonQuestions": string[],
    "sourceNotes": [{ "title": string, "url": string, "note": string }],
    "unknowns": string[]
  },
  "voiceAgentPackage": {
    "agentName": string,
    "agentRole": string,
    "tone": string,
    "conversationGoal": string,
    "openingScript": string,
    "qualificationQuestions": string[],
    "objectionHandlers": [{ "objection": string, "response": string }],
    "escalationRules": string[],
    "bookingInstructions": string,
    "complianceBoundaries": string[]
  }
}`;
}

function isOpenAIConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  );
}

function getClient(): OpenAI {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  return new OpenAI({ apiKey, baseURL });
}

function extractJson(text: string): unknown {
  let trimmed = text.trim();
  // Strip markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) trimmed = fenceMatch[1].trim();
  // Find first { and last } if there's prose
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start > 0 || end < trimmed.length - 1) {
    if (start !== -1 && end !== -1 && end > start) {
      trimmed = trimmed.slice(start, end + 1);
    }
  }
  return JSON.parse(trimmed);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}

function normalizeProfile(raw: unknown, input: EnrichInput): BusinessProfile {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {});
  return {
    businessName: asString(r.businessName, input.businessName),
    websiteUrl: asString(r.websiteUrl, input.websiteUrl),
    industry: asString(r.industry, input.industry || "unknown"),
    summary: asString(r.summary, "unknown"),
    services: asStringArray(r.services),
    serviceArea: asString(r.serviceArea, "unknown"),
    phone: asString(r.phone, "unknown"),
    hours: asString(r.hours, "unknown"),
    differentiators: asStringArray(r.differentiators),
    customerTypes: asStringArray(r.customerTypes),
    commonQuestions: asStringArray(r.commonQuestions),
    sourceNotes: Array.isArray(r.sourceNotes)
      ? (r.sourceNotes as unknown[]).map((s) => {
          const o = (s && typeof s === "object" ? (s as Record<string, unknown>) : {});
          return { title: asString(o.title), url: asString(o.url), note: asString(o.note) };
        }).filter((s) => s.url || s.title)
      : [],
    unknowns: asStringArray(r.unknowns),
  };
}

function normalizePackage(raw: unknown, input: EnrichInput): VoiceAgentPackage {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {});
  return {
    agentName: asString(r.agentName, "AI Receptionist"),
    agentRole: asString(r.agentRole, `AI assistant for ${input.businessName}`),
    tone: asString(r.tone, input.tone || "Friendly, professional, helpful"),
    conversationGoal: asString(r.conversationGoal, input.agentGoal),
    openingScript: asString(
      r.openingScript,
      `Hi, thanks for calling ${input.businessName}. This is the AI assistant — how can I help you today?`,
    ),
    qualificationQuestions: asStringArray(r.qualificationQuestions),
    objectionHandlers: Array.isArray(r.objectionHandlers)
      ? (r.objectionHandlers as unknown[]).map((s) => {
          const o = (s && typeof s === "object" ? (s as Record<string, unknown>) : {});
          return { objection: asString(o.objection), response: asString(o.response) };
        }).filter((o) => o.objection || o.response)
      : [],
    escalationRules: asStringArray(r.escalationRules),
    bookingInstructions: asString(
      r.bookingInstructions,
      input.primaryCta || "Collect the caller's contact info so a team member can follow up.",
    ),
    complianceBoundaries: asStringArray(r.complianceBoundaries),
  };
}

export function buildFinalPrompt(
  profile: BusinessProfile,
  pkg: VoiceAgentPackage,
  input: EnrichInput,
): string {
  const list = (arr: string[]) => (arr.length === 0 ? "(none captured)" : arr.map((x) => `- ${x}`).join("\n"));
  const objections =
    pkg.objectionHandlers.length === 0
      ? "(none captured)"
      : pkg.objectionHandlers
          .map((o) => `- "${o.objection}" → ${o.response}`)
          .join("\n");

  return `# Voice Agent Prompt for ${profile.businessName}

## Agent Identity

You are ${pkg.agentName}, a friendly and professional AI voice assistant for ${profile.businessName}.

Your job is to help callers understand the company's services, answer common questions, qualify the caller's needs, and guide them toward ${input.primaryCta || pkg.conversationGoal || "the next best step"}.

If asked, be honest that you are an AI assistant.

## Business Context

Business Name: ${profile.businessName}
Website: ${profile.websiteUrl}
Industry: ${profile.industry}
Location / Service Area: ${profile.serviceArea}
Phone: ${profile.phone}
Hours: ${profile.hours}

Business Summary:
${profile.summary}

Primary Services:
${list(profile.services)}

Target Customers:
${list(profile.customerTypes)}

Differentiators:
${list(profile.differentiators)}

## Conversation Goal

Your primary goal is to:

1. Greet the caller naturally.
2. Understand why they are calling.
3. Ask only the questions needed to qualify their request.
4. Provide helpful, accurate information based on the business profile.
5. Guide the caller toward ${input.primaryCta || "booking a follow-up"}.
6. Escalate to a human when needed.

## Voice and Tone

Use a tone that is:
- ${pkg.tone}
- Clear
- Conversational
- Helpful
- Not robotic
- Not overly pushy

Speak in short, natural sentences. Avoid long explanations unless the caller asks for more detail.

## Opening Script

${pkg.openingScript}

## Qualification Questions

Ask these only when relevant:

${list(pkg.qualificationQuestions)}

## Service Guidance

Use the listed services and the business summary above when answering questions.

Do not invent services, prices, guarantees, discounts, credentials, licenses, hours, service areas, or availability.

If something is unknown, say:

"I don't want to give you the wrong information, but I can collect your details and have someone from the team follow up."

## Objection Handling

${objections}

## Escalation Rules

Escalate to a human if:

${list(pkg.escalationRules)}

## Booking / CTA Instructions

Primary CTA: ${input.primaryCta || pkg.conversationGoal}

${pkg.bookingInstructions}

Collect:
- Name
- Phone
- Email
- Service needed
- Preferred time for follow-up
- Notes

## Boundaries

Do not:
- Make guarantees.
- Quote exact prices unless provided.
- Claim to be human.
- Diagnose medical, legal, financial, or technical issues beyond the provided business info.
- Invent business policies.
- Pressure the caller.
- Continue if the caller asks to speak with a person.

${pkg.complianceBoundaries.length > 0 ? `Additional compliance notes:\n${list(pkg.complianceBoundaries)}\n\n` : ""}## Final Conversation Style

Keep responses brief and human-sounding.

Ask one question at a time.

Confirm important details before moving forward.

When uncertain, escalate to a human.
`;
}

export async function runEnrichment(input: EnrichInput): Promise<EnrichmentResult> {
  if (!isOpenAIConfigured()) {
    throw new Error("OpenAI is not configured");
  }
  const client = getClient();

  // Use Responses API with web search. Tool name varies between SDK / API
  // versions: newer SDKs use "web_search", older ones use "web_search_preview".
  const responsesClient = (client as unknown as {
    responses: {
      create: (args: Record<string, unknown>) => Promise<{
        output_text?: string;
        output?: unknown;
      }>;
    };
  }).responses;
  const baseArgs = {
    model: process.env.OPENAI_ENRICHMENT_MODEL || "gpt-5-mini",
    instructions: SYSTEM_INSTRUCTION,
    input: buildUserPrompt(input),
  };
  let response;
  try {
    response = await responsesClient.create({
      ...baseArgs,
      tools: [{ type: "web_search" }],
    });
  } catch (err) {
    const msg = (err as Error).message || "";
    if (/web_search/i.test(msg)) {
      response = await responsesClient.create({
        ...baseArgs,
        tools: [{ type: "web_search_preview" }],
      });
    } else {
      throw err;
    }
  }

  const text = (response.output_text || "").trim();
  if (!text) {
    throw new Error("OpenAI returned no text output");
  }

  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch (err) {
    throw new Error(
      `Failed to parse OpenAI JSON response: ${(err as Error).message}`,
    );
  }

  if (!validateEnrichmentShape(parsed)) {
    throw new Error("OpenAI returned an unexpected response shape");
  }
  const root = parsed as { businessProfile?: unknown; voiceAgentPackage?: unknown };
  const profile = normalizeProfile(root.businessProfile, input);
  const pkg = normalizePackage(root.voiceAgentPackage, input);
  const aiGeneratedPrompt = buildFinalPrompt(profile, pkg, input);
  const limitedResults =
    profile.sourceNotes.length === 0 ||
    (profile.summary === "unknown" && profile.services.length === 0);

  return {
    businessProfile: profile,
    voiceAgentPackage: pkg,
    aiGeneratedPrompt,
    limitedResults,
  };
}

export { isOpenAIConfigured };
