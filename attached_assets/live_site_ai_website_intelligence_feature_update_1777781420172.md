# Replit Feature Update Prompt: Live Site AI Website Intelligence Layer

## Project

**Live Site AI**

## Feature Update Name

**Website Intelligence + AI Agent Prompt Generator**

## Purpose

Add a website intelligence layer to the existing **Live Site AI** app.

The goal is to let an agency create a richer demo from only a company website URL.

The app should be able to:

1. Fetch public website content from the prospect’s website.
2. Extract useful business information.
3. Use basic parsing if OpenAI is not configured.
4. Use OpenAI Responses API if `OPENAI_API_KEY` is configured.
5. Generate structured business context.
6. Generate a copyable GoHighLevel Voice AI agent prompt.
7. Generate a copyable chat context block.
8. Let the agency apply the extracted data to the demo record.
9. Prepare for a future direct “Update GHL Agent” button.

This update should not break the existing MVP.

---

# Important Build Instruction

Do not redesign the app.

Do not remove existing functionality.

Do not change the current GoHighLevel widget rendering logic.

Do not change the configurable `data-widget-id` behavior.

Add this as a new feature layer on top of the existing app.

The existing app should still work even if:

- The website cannot be fetched.
- OpenAI is not configured.
- The website has very little content.
- The site blocks server-side requests.

---

# Current App Assumptions

The current Live Site AI app already has:

- User auth
- Dashboard
- Demo creation
- Demo editing
- Public demo page
- Settings page
- Configurable GHL chat widget ID
- Demo-level chat widget override
- Voice AI phone number
- Generated Voice AI prompt
- Demo view and click tracking

This feature update should extend those capabilities.

---

# Feature Overview

Add a button called:

**Analyze Website**

This button should appear on:

1. Create Demo Page after a website URL is entered.
2. Edit Demo Page.
3. Demo Detail Page inside a new section called **Website Intelligence**.

When clicked, the app should analyze the prospect’s website and generate structured demo context.

---

# Website Intelligence Flow

When the user clicks **Analyze Website**, the app should:

1. Validate the demo belongs to the logged-in user.
2. Validate the website URL.
3. Normalize the URL so it includes `https://` if missing.
4. Fetch the homepage server-side.
5. Extract useful public content.
6. Clean the extracted content.
7. Extract basic metadata:
   - Page title
   - Meta description
   - Main headings
   - Visible body text
8. If OpenAI is configured, send the cleaned content to OpenAI Responses API.
9. If OpenAI is not configured, use a basic parser and keyword extraction fallback.
10. Return structured JSON to the frontend.
11. Save the analysis result to the demo record.
12. Display the result in the Website Intelligence section.

---

# Important Rules

Only use publicly accessible website content.

Do not scrape private pages.

Do not bypass login walls.

Do not defeat bot protection.

Do not scrape entire websites in the MVP.

Only fetch the homepage for this feature update.

Do not use browser automation unless it already exists in the app.

Do not require Puppeteer or Playwright.

Use server-side fetch plus HTML parsing first.

If the website blocks the request, show a helpful error and allow manual entry.

---

# Database Schema Update

Update the `demos` table with the following fields.

```txt
website_title
website_meta_description
website_headings
website_raw_text_excerpt
extracted_business_summary
extracted_services
extracted_service_area
extracted_faqs
extracted_tone
extracted_target_customers
suggested_chat_persona
suggested_voice_persona
suggested_lead_questions
generated_chat_context
generated_voice_prompt
missing_information
website_analysis_status
website_analysis_error
website_analyzed_at
website_analysis_source
```

## Field Types

Use sensible field types:

```txt
website_title: text / varchar
website_meta_description: text
website_headings: jsonb or text
website_raw_text_excerpt: text
extracted_business_summary: text
extracted_services: jsonb or text
extracted_service_area: text
extracted_faqs: jsonb or text
extracted_tone: text
extracted_target_customers: text
suggested_chat_persona: text
suggested_voice_persona: text
suggested_lead_questions: jsonb or text
generated_chat_context: text
generated_voice_prompt: text
missing_information: jsonb or text
website_analysis_status: text
website_analysis_error: text
website_analyzed_at: timestamp
website_analysis_source: text
```

## Analysis Status Values

Use these values:

```txt
not_started
in_progress
completed
failed
```

## Analysis Source Values

Use these values:

```txt
basic_parser
openai
manual
```

---

# Backend Service Files

Create or update the following service files.

---

## 1. `server/services/websiteFetchService.ts`

Purpose:

Fetch and clean public website content.

### Required Functions

```ts
export async function fetchWebsiteHtml(url: string): Promise<string> {
  // Normalize URL.
  // Fetch homepage HTML.
  // Use safe timeout.
  // Use reasonable headers.
  // Return HTML string.
}
```

```ts
export function normalizeWebsiteUrl(url: string): string {
  // Add https:// if missing.
  // Trim whitespace.
  // Reject javascript:, data:, file:, localhost, private IPs, and invalid URLs.
}
```

```ts
export function extractWebsiteContent(html: string) {
  // Extract:
  // - title
  // - meta description
  // - headings
  // - visible text
  // Remove scripts, styles, nav noise if practical.
}
```

### Fetch Requirements

Use:

- `fetch`
- `AbortController`
- Timeout of 10 to 15 seconds
- Reasonable user-agent header

Do not let a slow website hang the request.

---

## 2. `server/services/basicWebsiteAnalysisService.ts`

Purpose:

Provide a fallback analysis when OpenAI is not configured.

### Required Function

```ts
export function analyzeWebsiteBasic(input: {
  url: string;
  title?: string;
  metaDescription?: string;
  headings?: string[];
  text?: string;
}) {
  // Return structured analysis object.
}
```

### Basic Analysis Should Attempt To Return

```ts
{
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
}
```

### Basic Parser Logic

Use simple heuristics:

- Use title and meta description for company summary.
- Use headings and repeated terms to infer services.
- Look for service-related words like:
  - services
  - repairs
  - installation
  - consultation
  - financing
  - roofing
  - dental
  - mortgage
  - real estate
  - solar
  - HVAC
  - plumbing
  - med spa
  - landscaping
- Look for location clues:
  - city names in title/meta/headings
  - “serving”
  - “service area”
  - “near”
  - “NJ”
  - “New Jersey”
  - “Monmouth County”
  - “Ocean County”
- If unknown, return `"Unknown"`.

Do not invent facts.

If something is not visible, put it in `missing_information`.

---

## 3. `server/services/openAiWebsiteAnalysisService.ts`

Purpose:

Analyze extracted website content using OpenAI Responses API when `OPENAI_API_KEY` is configured.

### Required Function

```ts
export async function analyzeWebsiteWithOpenAI(input: {
  url: string;
  title?: string;
  metaDescription?: string;
  headings?: string[];
  text?: string;
}) {
  // Use OpenAI Responses API.
  // Return structured JSON.
}
```

### Important OpenAI Rules

Use the OpenAI Responses API.

Do not use the deprecated Assistants API.

If the OpenAI request fails, fallback to the basic parser.

Never expose the OpenAI API key to the frontend.

Limit the website text sent to OpenAI to a reasonable size.

Use only website content provided.

Do not invent facts.

---

# OpenAI Prompt

Use this prompt server-side when OpenAI is enabled.

```txt
You are analyzing a business website to help create a GoHighLevel AI chat and voice demo.

Use only the website content provided.

Do not invent facts.

If information is not available in the website content, mark it as unknown or include it in missing_information.

Return only valid JSON.

Return structured JSON with the following fields:

company_summary:
A short summary of what the business does.

likely_services:
An array of services the business appears to offer.

service_area:
The geographic area the business appears to serve. If unknown, return "Unknown".

business_tone:
A short description of the website’s tone, such as professional, friendly, luxury, clinical, urgent, local, family-owned, etc.

target_customers:
A short description of the likely customers.

suggested_chat_persona:
A short description of the recommended chat assistant persona.

suggested_voice_persona:
A short description of the recommended Voice AI persona.

suggested_lead_questions:
An array of 5 to 8 lead qualification questions.

suggested_faqs:
An array of objects with:
- question
- answer_guidance

generated_voice_prompt:
A complete Voice AI prompt suitable for a GoHighLevel Voice AI agent.

generated_chat_context:
A short knowledge/context block suitable for a GoHighLevel chat widget or chat persona.

missing_information:
An array of important items that were not found on the website and should be confirmed manually.
```

## Website Content Payload

Send OpenAI structured input like:

```txt
Website URL:
{{website_url}}

Page Title:
{{website_title}}

Meta Description:
{{website_meta_description}}

Headings:
{{website_headings}}

Extracted Website Text:
{{cleaned_text_excerpt}}
```

---

# Generated Voice AI Prompt Requirements

The generated Voice AI prompt should be complete enough to paste into GoHighLevel.

It should include:

```md
# Role

You are the AI receptionist for {{company_name}}.

# Primary Goal

Answer inbound calls professionally, help the caller understand the business, qualify their need, and guide them toward booking an appointment or requesting a callback.

# Business Context

Business Name: {{company_name}}
Website: {{website_url}}
Industry: {{industry}}
Company Summary: {{company_summary}}
Services: {{likely_services}}
Service Area: {{service_area}}
Target Customers: {{target_customers}}
Voice Persona: {{suggested_voice_persona}}
Tone: {{business_tone}}

# Conversation Rules

- Sound natural and human.
- Keep answers short.
- Ask one question at a time.
- Do not invent services, pricing, guarantees, or availability.
- Use only known business information.
- If unsure, offer to have a team member follow up.
- Always try to capture name, phone, email, reason for calling, and preferred callback time.

# Opening Message

Hi, thanks for calling {{company_name}}. This is the AI assistant for the team. I can help answer questions, take a message, or help get you pointed in the right direction. What can I help you with today?

# Qualification Questions

{{suggested_lead_questions}}

# FAQ Guidance

{{suggested_faqs}}

# Escalation

If the caller asks for a human, pricing, emergency service, legal, medical, financial advice, or something outside the known business information, collect their information and say a team member will follow up.
```

---

# Generated Chat Context Requirements

The generated chat context should be a short knowledge block that can be copied and used inside HighLevel chat setup.

It should include:

```md
# Business Context

Business Name:
{{company_name}}

Website:
{{website_url}}

Summary:
{{company_summary}}

Services:
{{likely_services}}

Service Area:
{{service_area}}

Tone:
{{business_tone}}

Recommended Chat Persona:
{{suggested_chat_persona}}

Lead Capture Goals:
Capture name, phone, email, service needed, location, urgency, and preferred follow-up time.

Important Rules:
Do not invent pricing, availability, guarantees, licenses, or credentials not found on the website.
If unsure, offer to have a team member follow up.
```

---

# API Routes

Add the following route:

```txt
POST /api/demos/:id/analyze-website
```

## Route Behavior

The route should:

1. Require authentication.
2. Verify the demo belongs to the authenticated user.
3. Set `website_analysis_status` to `in_progress`.
4. Fetch the demo’s website URL.
5. Extract website content.
6. Determine whether `OPENAI_API_KEY` exists.
7. If OpenAI is configured, call `analyzeWebsiteWithOpenAI`.
8. If OpenAI is not configured, call `analyzeWebsiteBasic`.
9. Save the results to the demo record.
10. Set `website_analysis_status` to `completed`.
11. Set `website_analysis_source` to either `openai` or `basic_parser`.
12. Set `website_analyzed_at` to the current timestamp.
13. Return the updated analysis data.

## Error Behavior

If the website cannot be fetched:

1. Set `website_analysis_status` to `failed`.
2. Save a friendly error in `website_analysis_error`.
3. Return a useful error response to the frontend.
4. Do not delete existing manual fields.
5. Do not crash the app.

---

# Frontend Updates

---

## Create Demo Page

Add an **Analyze Website** button after the website URL field.

Behavior:

- If the demo has not been saved yet, either:
  1. Save the demo first, then run analysis.
  2. Or show a message: “Save the demo first, then analyze the website.”

Preferred behavior:

Save the demo first, then run analysis automatically.

Show loading state:

```txt
Analyzing website...
```

Show success state:

```txt
Website analysis complete.
```

Show failure state:

```txt
We could not analyze this website. You can still enter the business details manually.
```

---

## Edit Demo Page

Add **Analyze Website** and **Re-analyze Website** buttons.

If analysis exists, show the latest extracted summary.

Do not overwrite manual fields automatically.

---

## Demo Detail Page

Add a new section called:

**Website Intelligence**

### Display Fields

Show:

- Analysis status
- Last analyzed date
- Analysis source
- Website title
- Meta description
- Company summary
- Extracted services
- Service area
- Business tone
- Target customers
- Suggested chat persona
- Suggested voice persona
- Suggested lead questions
- Suggested FAQs
- Missing information

### Buttons

Include:

- Analyze Website
- Re-analyze Website
- Copy Chat Context
- Copy Voice Prompt
- Apply to Demo Fields

---

# Apply to Demo Fields

Add a button:

**Apply to Demo Fields**

When clicked, use extracted analysis to populate:

- Company Description
- Services Offered
- Service Area
- Chat Persona Name
- Voice Persona Name
- Generated Voice AI Prompt

## Important Overwrite Rule

Do not overwrite existing manually entered fields without warning.

If any target fields already have values, show a confirmation modal:

```txt
Some fields already contain information. Applying website intelligence may replace existing values. Do you want to continue?
```

Buttons:

- Cancel
- Apply Website Intelligence

For the MVP, it is acceptable to overwrite only empty fields by default and require confirmation to overwrite populated fields.

---

# Generated Prompt Display

Update the **Generated Voice AI Prompt** section to prefer:

1. `demo.generated_voice_prompt` from website intelligence if available.
2. Existing template-based prompt if no website intelligence exists.

Add a label:

```txt
Prompt Source: Website Intelligence
```

or

```txt
Prompt Source: Template
```

Add a copy button.

---

# Chat Context Display

Add a new copyable section:

**Generated Chat Context**

Use:

1. `demo.generated_chat_context` if available.
2. A simple template if website intelligence does not exist.

Add a copy button.

---

# Future GHL Agent Update Preparation

Add a disabled button on the Demo Detail Page:

**Update GHL Agent**

For now, it should be disabled unless a future GHL integration flag is enabled.

Helper text:

```txt
Coming soon: connect your GHL API credentials to update the agent directly.
```

This button is for a future phase where the app will use:

- generated_voice_prompt
- voice_persona_name
- company_name
- service_area
- services_offered
- lead qualification questions

to update the selected GoHighLevel Voice AI agent.

Do not implement direct GHL agent updating in this feature update.

---

# Settings Page Update

Add an optional toggle:

```txt
Enable OpenAI Website Intelligence
```

Behavior:

- If enabled and `OPENAI_API_KEY` exists, use OpenAI.
- If disabled, use basic parser.
- If enabled but `OPENAI_API_KEY` is missing, show a friendly warning and fallback to basic parser.

Add helper text:

```txt
When enabled, Live Site AI uses OpenAI to turn public website content into demo context, chat notes, and a Voice AI prompt. If no API key is configured, the app uses a basic parser instead.
```

Do not expose the actual OpenAI API key in the frontend.

---

# Environment Variables

Add:

```env
OPENAI_API_KEY=
```

Optional:

```env
OPENAI_MODEL=gpt-4.1-mini
```

If `OPENAI_MODEL` is not set, use a sensible default available to the app.

Do not require this variable for the app to run.

---

# UI/UX Requirements

Use the existing app style.

The new Website Intelligence section should look like a clean SaaS feature panel.

Use:

- Cards
- Badges
- Copy buttons
- Loading states
- Error states
- Collapsible long text sections where appropriate

The interface should make it clear that website analysis is a helper, not a guaranteed source of truth.

Add a small note:

```txt
Website Intelligence uses public website content only. Review all generated prompts before using them in a live agent.
```

---

# Error Messages

Use friendly errors.

Examples:

```txt
We could not reach this website. You can still complete the demo manually.
```

```txt
This website did not return enough public text to generate a strong prompt.
```

```txt
OpenAI analysis failed, so we used the basic website parser instead.
```

```txt
This site may block automated requests. Try entering the services and business description manually.
```

---

# Security Requirements

Do not allow SSRF vulnerabilities.

URL validation must block:

- localhost
- 127.0.0.1
- 0.0.0.0
- private IP ranges
- file://
- data:
- javascript:
- internal network addresses

Do not fetch arbitrary non-http protocols.

Only allow `http://` and `https://`.

Prefer `https://`.

Do not execute website scripts.

Do not render raw scraped HTML.

Only store and display sanitized extracted text.

Never expose server-side secrets to the browser.

---

# Acceptance Criteria

This feature update is complete when:

1. The app has a working **Analyze Website** button.
2. The backend can fetch and parse public homepage HTML.
3. The app extracts title, meta description, headings, and visible text.
4. If OpenAI is configured, the app uses OpenAI Responses API.
5. If OpenAI is not configured, the app uses a basic parser.
6. If OpenAI fails, the app falls back to the basic parser.
7. The analysis result is saved to the demo record.
8. The Demo Detail Page shows a Website Intelligence section.
9. The user can copy generated chat context.
10. The user can copy generated Voice AI prompt.
11. The user can apply website intelligence to demo fields.
12. The app warns before overwriting manually entered data.
13. The public demo page continues to work.
14. The configurable GHL chat widget ID still works.
15. The Voice AI phone button still works.
16. Existing demos are not broken by the migration.
17. The app handles blocked or unreachable websites gracefully.
18. API keys remain server-side only.
19. The app blocks unsafe URL targets.
20. The feature is clean enough to use in a client-facing demo workflow.

---

# Post-Build QA Prompt

After implementing this feature, run this follow-up prompt:

```md
Review the Website Intelligence feature for bugs.

Do not redesign the app.

Only fix issues required to make the feature work.

Confirm that:

1. Existing demos still load.
2. New demos can still be created.
3. Settings still save correctly.
4. Configurable GHL widget IDs still resolve correctly.
5. Public demo pages still load the chat widget.
6. Analyze Website works on a normal public website.
7. Analyze Website fails gracefully on blocked sites.
8. OpenAI is optional.
9. Basic parser fallback works.
10. Generated Voice AI prompt can be copied.
11. Generated Chat Context can be copied.
12. Apply to Demo Fields does not overwrite manual fields without warning.
13. Unsafe URLs are blocked.
14. No API keys are exposed to the frontend.
```

---

# Optional Future Phase

Do not implement this yet, but leave the code organized for it.

Future feature:

**Direct GHL Agent Update**

The app will eventually let the user click:

```txt
Update GHL Agent
```

This will push the generated Voice AI prompt and persona settings into GoHighLevel using the GHL API.

For now, keep this button disabled and show helper text.
