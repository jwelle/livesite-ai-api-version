import {
  AnalysisInput,
  StructuredAnalysis,
  buildChatContext,
  buildVoicePrompt,
} from "./websiteAnalysisShared";

const ANALYSIS_TEXT_CAP = 8_000;

function getOpenAiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    "";
  if (!apiKey) return null;
  const baseUrl =
    process.env.OPENAI_BASE_URL ||
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, ""), model };
}

export function isOpenAiConfigured(): boolean {
  return getOpenAiConfig() !== null;
}

const SYSTEM_PROMPT = `You are analyzing a business website to help create a GoHighLevel AI chat and voice demo.
Use only the website content provided. Do not invent facts.
If information is not available, mark it as Unknown or include it in missing_information.
Return only valid JSON matching the requested schema.`;

function buildUserMessage(input: AnalysisInput): string {
  const headings = (input.headings || []).slice(0, 30).join("\n- ");
  return `Website URL:
${input.url}

Company Name (from operator):
${input.companyName}

Industry (from operator, may be empty):
${input.industry || ""}

Page Title:
${input.title || ""}

Meta Description:
${input.metaDescription || ""}

Headings:
- ${headings}

Extracted Website Text:
${(input.text || "").slice(0, ANALYSIS_TEXT_CAP)}

Return JSON with these fields:
- company_summary (string): short summary of what the business does.
- likely_services (string[]): services the business appears to offer.
- service_area (string): geographic area; "Unknown" if unclear.
- business_tone (string): short description of website tone.
- target_customers (string): short description of likely customers.
- suggested_chat_persona (string): recommended chat assistant persona.
- suggested_voice_persona (string): recommended Voice AI persona.
- suggested_lead_questions (string[]): 5 to 8 lead qualification questions.
- suggested_faqs (Array<{ question, answer_guidance }>): 3 to 6 FAQs.
- missing_information (string[]): items not found that should be confirmed manually.

Do not include generated_voice_prompt or generated_chat_context — those will be assembled from the structured fields.`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    company_summary: { type: "string" },
    likely_services: { type: "array", items: { type: "string" } },
    service_area: { type: "string" },
    business_tone: { type: "string" },
    target_customers: { type: "string" },
    suggested_chat_persona: { type: "string" },
    suggested_voice_persona: { type: "string" },
    suggested_lead_questions: { type: "array", items: { type: "string" } },
    suggested_faqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          answer_guidance: { type: "string" },
        },
        required: ["question", "answer_guidance"],
      },
    },
    missing_information: { type: "array", items: { type: "string" } },
  },
  required: [
    "company_summary",
    "likely_services",
    "service_area",
    "business_tone",
    "target_customers",
    "suggested_chat_persona",
    "suggested_voice_persona",
    "suggested_lead_questions",
    "suggested_faqs",
    "missing_information",
  ],
} as const;

type PartialAnalysis = Omit<StructuredAnalysis, "generated_voice_prompt" | "generated_chat_context">;

function extractJson(text: string): unknown {
  // Try direct parse, then strip markdown fences
  try { return JSON.parse(text); } catch { /* try next */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]!); } catch { /* try next */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* fallthrough */ }
  }
  throw new Error("OpenAI response was not valid JSON");
}

export async function analyzeWebsiteWithOpenAI(input: AnalysisInput): Promise<StructuredAnalysis> {
  const cfg = getOpenAiConfig();
  if (!cfg) throw new Error("OpenAI is not configured");

  const body = {
    model: cfg.model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(input) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "WebsiteAnalysis",
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/responses`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI Responses API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const json: any = await res.json();

  // Responses API: prefer output_text helper if present, else first output.content[].text
  let raw = "";
  if (typeof json.output_text === "string" && json.output_text) {
    raw = json.output_text;
  } else if (Array.isArray(json.output)) {
    for (const item of json.output) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string") {
            raw += c.text;
          } else if (c?.type === "output_text" && typeof c?.text === "string") {
            raw += c.text;
          }
        }
      }
    }
  }
  if (!raw) {
    throw new Error("OpenAI response was empty");
  }

  const parsed = extractJson(raw) as PartialAnalysis;
  // Defensive normalization
  const partial: PartialAnalysis = {
    company_summary: String(parsed.company_summary || "").trim(),
    likely_services: Array.isArray(parsed.likely_services) ? parsed.likely_services.map(String) : [],
    service_area: String(parsed.service_area || "Unknown").trim() || "Unknown",
    business_tone: String(parsed.business_tone || "professional, friendly").trim(),
    target_customers: String(parsed.target_customers || "Unknown").trim(),
    suggested_chat_persona: String(parsed.suggested_chat_persona || "").trim(),
    suggested_voice_persona: String(parsed.suggested_voice_persona || "").trim(),
    suggested_lead_questions: Array.isArray(parsed.suggested_lead_questions)
      ? parsed.suggested_lead_questions.map(String)
      : [],
    suggested_faqs: Array.isArray(parsed.suggested_faqs)
      ? parsed.suggested_faqs.map((f: any) => ({
          question: String(f?.question || "").trim(),
          answer_guidance: String(f?.answer_guidance || "").trim(),
        })).filter((f) => f.question)
      : [],
    missing_information: Array.isArray(parsed.missing_information)
      ? parsed.missing_information.map(String)
      : [],
  };

  return {
    ...partial,
    generated_voice_prompt: buildVoicePrompt(input, partial),
    generated_chat_context: buildChatContext(input, partial),
  };
}
