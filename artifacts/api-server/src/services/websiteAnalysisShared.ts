export type StructuredAnalysis = {
  company_summary: string;
  likely_services: string[];
  service_area: string;
  business_tone: string;
  target_customers: string;
  suggested_chat_persona: string;
  suggested_voice_persona: string;
  suggested_lead_questions: string[];
  suggested_faqs: Array<{ question: string; answer_guidance: string }>;
  generated_voice_prompt: string;
  generated_chat_context: string;
  missing_information: string[];
};

export type AnalysisInput = {
  url: string;
  companyName: string;
  industry?: string | null;
  title?: string;
  metaDescription?: string;
  headings?: string[];
  text?: string;
};

function listOrUnknown(items: string[] | undefined): string {
  if (!items || items.length === 0) return "Unknown";
  return items.join(", ");
}

function bulletList(items: string[]): string {
  return items.map((q, i) => `${i + 1}. ${q}`).join("\n");
}

function faqsList(faqs: Array<{ question: string; answer_guidance: string }>): string {
  if (!faqs.length) return "No FAQs available — collect the caller's question and offer to follow up.";
  return faqs
    .map((f, i) => `${i + 1}. Q: ${f.question}\n   Guidance: ${f.answer_guidance}`)
    .join("\n");
}

export function buildVoicePrompt(input: AnalysisInput, a: Omit<StructuredAnalysis, "generated_voice_prompt" | "generated_chat_context">): string {
  const companyName = input.companyName || "the business";
  const websiteUrl = input.url || "";
  const industry = input.industry || "General Business";
  return `# Role

You are the AI receptionist for ${companyName}.

# Primary Goal

Answer inbound calls professionally, help the caller understand the business, qualify their need, and guide them toward booking an appointment or requesting a callback.

# Business Context

Business Name: ${companyName}
Website: ${websiteUrl}
Industry: ${industry}
Company Summary: ${a.company_summary}
Services: ${listOrUnknown(a.likely_services)}
Service Area: ${a.service_area || "Unknown"}
Target Customers: ${a.target_customers || "Unknown"}
Voice Persona: ${a.suggested_voice_persona}
Tone: ${a.business_tone}

# Conversation Rules

- Sound natural and human.
- Keep answers short.
- Ask one question at a time.
- Do not invent services, pricing, guarantees, or availability.
- Use only known business information.
- If unsure, offer to have a team member follow up.
- Always try to capture name, phone, email, reason for calling, and preferred callback time.

# Opening Message

Hi, thanks for calling ${companyName}. This is the AI assistant for the team. I can help answer questions, take a message, or help get you pointed in the right direction. What can I help you with today?

# Qualification Questions

${bulletList(a.suggested_lead_questions)}

# FAQ Guidance

${faqsList(a.suggested_faqs)}

# Escalation

If the caller asks for a human, pricing, emergency service, legal, medical, financial advice, or something outside the known business information, collect their information and say a team member will follow up.`;
}

export function buildChatContext(input: AnalysisInput, a: Omit<StructuredAnalysis, "generated_voice_prompt" | "generated_chat_context">): string {
  const companyName = input.companyName || "the business";
  return `# Business Context

Business Name:
${companyName}

Website:
${input.url || ""}

Summary:
${a.company_summary}

Services:
${listOrUnknown(a.likely_services)}

Service Area:
${a.service_area || "Unknown"}

Tone:
${a.business_tone}

Recommended Chat Persona:
${a.suggested_chat_persona}

Lead Capture Goals:
Capture name, phone, email, service needed, location, urgency, and preferred follow-up time.

Important Rules:
Do not invent pricing, availability, guarantees, licenses, or credentials not found on the website.
If unsure, offer to have a team member follow up.`;
}
