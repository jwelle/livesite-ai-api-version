import {
  AnalysisInput,
  StructuredAnalysis,
  buildChatContext,
  buildVoicePrompt,
} from "./websiteAnalysisShared";

const SERVICE_KEYWORDS = [
  "roofing", "plumbing", "hvac", "electrical", "solar", "landscaping",
  "dental", "orthodontics", "chiropractic", "med spa", "medspa", "aesthetics",
  "real estate", "mortgage", "insurance", "law firm", "legal", "accounting",
  "consulting", "marketing", "agency", "construction", "remodeling",
  "cleaning", "painting", "moving", "auto repair", "towing",
  "fitness", "personal training", "yoga", "salon", "barber", "spa",
  "veterinary", "pet grooming", "daycare", "tutoring",
  "restaurant", "catering", "bakery", "coffee",
  "installation", "repairs", "consultation", "financing",
];

const TONE_HINTS: Array<{ pattern: RegExp; tone: string }> = [
  { pattern: /\b(luxury|premium|exclusive|bespoke)\b/i, tone: "luxury, premium" },
  { pattern: /\b(family[- ]owned|family[- ]run|since 19|since 20)\b/i, tone: "local, family-owned" },
  { pattern: /\b(emergency|24\/7|same[- ]day|urgent)\b/i, tone: "urgent, responsive" },
  { pattern: /\b(award|trusted|certified|licensed|insured)\b/i, tone: "professional, trustworthy" },
  { pattern: /\b(friendly|welcome|community|neighborhood)\b/i, tone: "friendly, community-focused" },
  { pattern: /\b(clinic|dr\.?|doctor|patient|treatment)\b/i, tone: "clinical, professional" },
];

const STATE_ABBR = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function analyzeWebsiteBasic(input: AnalysisInput): StructuredAnalysis {
  const haystack = [
    input.title || "",
    input.metaDescription || "",
    ...(input.headings || []),
    input.text || "",
  ]
    .join(" \n ")
    .toLowerCase();

  const missing: string[] = [];

  // Summary
  let company_summary = "";
  if (input.metaDescription && input.metaDescription.length > 20) {
    company_summary = input.metaDescription.trim();
  } else if (input.title) {
    company_summary = input.title.trim();
  } else {
    company_summary = `${input.companyName} — see ${input.url} for details.`;
    missing.push("Clear company description");
  }

  // Services
  const found = new Set<string>();
  for (const kw of SERVICE_KEYWORDS) {
    if (haystack.includes(kw)) found.add(kw);
  }
  // Headings often contain services
  for (const h of input.headings || []) {
    const lower = h.toLowerCase();
    if (lower.length > 4 && lower.length < 60 && /(service|solution|offer|expert|special)/.test(lower)) {
      found.add(h.trim());
    }
  }
  const likely_services = [...found].slice(0, 12);
  if (likely_services.length === 0) missing.push("Specific services offered");

  // Service area
  let service_area = "Unknown";
  const text = `${input.title || ""} ${input.metaDescription || ""} ${(input.headings || []).join(" ")} ${input.text || ""}`;
  const servingMatch = text.match(/serving\s+([A-Z][A-Za-z .,&'-]{3,80})/);
  const nearMatch = text.match(/(?:near|located in|based in)\s+([A-Z][A-Za-z .,&'-]{3,80})/);
  const countyMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+County)/);
  const cityState = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(?:[A-Z]{2}|[A-Z][a-z]+)/);
  if (servingMatch) service_area = servingMatch[1]!.replace(/[.,]+$/, "").trim();
  else if (nearMatch) service_area = nearMatch[1]!.replace(/[.,]+$/, "").trim();
  else if (countyMatch) service_area = countyMatch[1]!.trim();
  else if (cityState) service_area = cityState[0]!.trim();
  else {
    for (const abbr of STATE_ABBR) {
      const re = new RegExp(`\\b${abbr}\\b`);
      if (re.test(text)) { service_area = abbr; break; }
    }
  }
  if (service_area === "Unknown") missing.push("Geographic service area");

  // Tone
  let business_tone = "professional, friendly";
  for (const hint of TONE_HINTS) {
    if (hint.pattern.test(text)) { business_tone = hint.tone; break; }
  }

  // Target customers (heuristic)
  let target_customers = "Unknown";
  if (/\b(homeowner|residential)\b/i.test(text)) target_customers = "Homeowners and residential clients";
  else if (/\b(business|commercial|b2b|enterprise)\b/i.test(text)) target_customers = "Businesses and commercial clients";
  else if (/\b(patient|client|customer)\b/i.test(text)) target_customers = "Local clients seeking professional services";
  else missing.push("Typical target customer profile");

  const personaBase = input.companyName ? `${input.companyName} AI Assistant` : "AI Assistant";
  const suggested_chat_persona = `${personaBase} — knowledgeable, friendly, and focused on capturing leads for the team.`;
  const suggested_voice_persona = `Warm, professional ${personaBase.toLowerCase()} who answers calls calmly, qualifies the caller's need, and books appointments.`;

  const suggested_lead_questions = [
    "What service or help are you looking for today?",
    "Are you looking for help right now or just gathering information?",
    "What city or town are you in?",
    "What's the best phone number for our team to reach you?",
    "What's the best email for any follow-up details?",
    "When is the best time for a team member to follow up?",
    "Have you worked with us before?",
  ];

  const suggested_faqs = [
    {
      question: "What are your hours?",
      answer_guidance: "If hours weren't found on the site, say a team member will confirm and follow up.",
    },
    {
      question: "What services do you offer?",
      answer_guidance: likely_services.length
        ? `Mention: ${likely_services.slice(0, 5).join(", ")}.`
        : "Ask the caller what they need and offer to have a team member follow up.",
    },
    {
      question: "Do you serve my area?",
      answer_guidance:
        service_area !== "Unknown"
          ? `Confirm we serve ${service_area} and ask the caller's location.`
          : "Ask the caller for their location and offer to have a team member confirm coverage.",
    },
    {
      question: "How much does it cost?",
      answer_guidance: "Do not quote pricing. Capture details and offer a callback for a quote.",
    },
  ];

  if (!input.industry) missing.push("Industry / vertical");

  const partial: Omit<StructuredAnalysis, "generated_voice_prompt" | "generated_chat_context"> = {
    company_summary,
    likely_services,
    service_area,
    business_tone,
    target_customers,
    suggested_chat_persona,
    suggested_voice_persona,
    suggested_lead_questions,
    suggested_faqs,
    missing_information: missing,
  };

  return {
    ...partial,
    generated_voice_prompt: buildVoicePrompt(input, partial),
    generated_chat_context: buildChatContext(input, partial),
  };
}
