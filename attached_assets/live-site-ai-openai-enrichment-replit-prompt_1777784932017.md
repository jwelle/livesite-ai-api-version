# Live Site AI: OpenAI Web Search Enrichment + Optional Voice Agent Prompt Editor

## Project Objective

Build or update the Live Site AI application so an agency user can create a personalized AI voice-agent demo for a prospect by entering basic business information.

The app should use OpenAI web search to research the business, generate a structured business profile, and create a ready-to-use voice-agent prompt for GoHighLevel or a similar AI voice-agent platform.

The user should be able to use the AI-generated prompt immediately, but they should also have the option to manually edit it before saving, copying, exporting, or pushing it to GHL.

Version 1 should be simple, stable, and focused.

Do not build a custom website scraper, crawler, Puppeteer process, Cheerio parser, sitemap parser, or browser automation system in Version 1.

The primary enrichment method should be OpenAI web search through the OpenAI Responses API.

---

## Core Product Concept

Live Site AI helps agencies quickly create customized AI voice-agent demos for prospects.

The basic workflow is:

1. Agency enters prospect business details.
2. App uses OpenAI web search to research the business.
3. App generates a structured business profile.
4. App generates a voice-agent prompt package.
5. User can use the AI-generated prompt as-is or manually edit it.
6. User saves, copies, exports, or pushes the final working prompt.

The app should feel like:

“Enter a business website. Get a ready-to-use AI voice-agent prompt.”

---

## Version 1 Product Rules

For Version 1:

- Use OpenAI web search as the primary enrichment method.
- Do not scrape websites directly.
- Do not parse website HTML.
- Do not use Puppeteer.
- Do not use Cheerio.
- Do not build a crawler.
- Do not build sitemap parsing.
- Do not auto-update a live agent without user action.
- Manual editing should be available, but not required.
- The AI-generated prompt should be usable immediately.
- Store the original AI-generated prompt separately from the current working prompt.
- If the user edits the prompt, preserve both versions.

---

## Required User Flow

### Step 1: Create Demo

User clicks:

Create New Demo

The form should ask for:

- Business Name
- Website URL
- Industry / Category
- Voice Agent Goal
- Desired Tone
- Primary CTA
- Optional Notes
- GHL Chat Widget ID
- Optional GHL Voice Agent ID

Example values:

Business Name: Shoreline Dental  
Website URL: https://example.com  
Industry: Dentist  
Voice Agent Goal: Book new patient consultations  
Desired Tone: Warm, professional, helpful  
Primary CTA: Schedule an appointment  
Optional Notes: Focus on new patient inquiries and emergency dental calls  

---

### Step 2: Run AI Enrichment

User clicks:

Enrich With AI

The backend should call OpenAI using the Responses API with web search enabled.

The app should research the business using:

- Business name
- Website URL
- Industry/category
- Voice agent goal
- Optional user notes

The AI should return structured JSON.

---

### Step 3: Display AI Findings

After enrichment, display the results in clean, editable sections:

1. Business Profile
2. Services Found
3. Service Area
4. Customer Types
5. Differentiators
6. Common Questions
7. Unknowns / Needs Review
8. Source Notes
9. Recommended Voice Agent Strategy
10. Opening Script
11. Qualification Questions
12. Objection Handlers
13. Escalation Rules
14. Final Voice Agent Prompt

Each major section should be editable if practical.

The final prompt editor is optional for the user, but it must be available.

---

### Step 4: Optional Manual Prompt Editing

Manual editing should be available as an option, but it should not be a required workflow step.

After AI enrichment, the user should be able to:

- Use the AI-generated prompt as-is
- Edit the prompt manually
- Save a draft
- Copy the prompt
- Export the prompt
- Regenerate the prompt
- Reset edits back to the AI-generated version
- Push the prompt to GHL if configured

The app should clearly distinguish between:

- AI Generated Prompt
- Current Working Prompt
- Final Saved Prompt

When the AI generates the prompt, automatically copy it into the editable prompt field as the default working version.

The user can use that default version without making changes.

If the user edits the prompt, save the edited version separately from the original AI-generated prompt.

Do not require the user to manually edit the prompt before copying, exporting, saving, or pushing it.

Manual editing is optional.

---

### Step 5: Save / Copy / Export / Push

Buttons:

- Save Draft
- Save Final Prompt
- Copy Prompt
- Export Markdown
- Export JSON
- Push to GHL

For Version 1, Push to GHL can be built as a placeholder if API access is not configured.

If GHL push is not configured, show:

“GHL push is not configured yet. You can copy the final prompt and paste it into your voice agent manually.”

---

## Required Pages / Screens

### 1. Dashboard

Show a list of demos.

Each demo card should display:

- Business Name
- Website URL
- Industry
- Status
- Created Date
- Last Updated Date

Each card should have buttons:

- Open
- Edit
- Copy Prompt
- Delete

Suggested statuses:

- Draft
- Enriched
- Edited
- Approved
- Copied
- Pushed to GHL
- Failed

---

### 2. Create Demo Page

Fields:

- Business Name
- Website URL
- Industry / Category
- Voice Agent Goal
- Desired Tone
- Primary CTA
- Optional Notes
- GHL Chat Widget ID
- Optional GHL Voice Agent ID

Buttons:

- Save Draft
- Enrich With AI

---

### 3. Demo Enrichment Results Page

Display the following sections.

---

## Business Profile Section

Editable fields:

- Business Name
- Website URL
- Industry
- Business Summary
- Service Area
- Phone Number
- Business Hours
- Customer Types
- Differentiators

---

## Services Found Section

Editable list.

Allow:

- Add service
- Edit service
- Delete service

---

## Common Questions Section

Editable list.

Allow:

- Add question
- Edit question
- Delete question

---

## Unknowns / Needs Review Section

Editable list of things the AI could not confirm.

Examples:

- Pricing unknown
- Business hours unknown
- Exact service area unknown
- Booking link unknown
- Emergency availability unknown

---

## Source Notes Section

Show the public source notes returned by OpenAI.

Each source note should include:

- Title
- URL
- Short note

---

## Voice Agent Strategy Section

Editable fields:

- Agent Name
- Agent Role
- Voice Tone
- Conversation Goal
- Primary CTA
- Booking Instructions

---

## Opening Script Section

Editable text area.

---

## Qualification Questions Section

Editable list.

Allow:

- Add question
- Edit question
- Delete question
- Reorder questions

---

## Objection Handlers Section

Editable list.

Each objection handler should include:

- Objection
- Suggested Response

Allow:

- Add objection
- Edit objection
- Delete objection

---

## Escalation Rules Section

Editable list.

Allow:

- Add rule
- Edit rule
- Delete rule

---

## Final Voice Agent Prompt Editor

Create a large editable text area called:

Final Voice Agent Prompt

This text area should be prefilled with the AI-generated prompt.

The user can:

- Leave it unchanged and use it immediately
- Edit it manually
- Save it as a draft
- Save it as the final prompt
- Copy it
- Export it
- Push it to GHL if configured

Buttons:

- Save Draft
- Save Final Prompt
- Copy Prompt
- Reset to AI Version
- Regenerate Prompt
- Export Markdown
- Export JSON
- Push to GHL

---

## Prompt Editor Behavior

The app should manage prompt versions carefully.

Store:

- aiGeneratedPrompt
- currentWorkingPrompt
- finalSavedPrompt
- editedFinalPrompt, if different from aiGeneratedPrompt
- promptVersions

Rules:

- The AI-generated prompt should become the default currentWorkingPrompt.
- The user may use currentWorkingPrompt immediately without editing.
- If the user edits the text area, update currentWorkingPrompt.
- If the user clicks Save Final Prompt, save currentWorkingPrompt as finalSavedPrompt.
- If the user clicks Reset to AI Version, replace currentWorkingPrompt with aiGeneratedPrompt.
- If the user clicks Copy Prompt, copy currentWorkingPrompt.
- If the user clicks Export Markdown, export currentWorkingPrompt as Markdown.
- If the user clicks Export JSON, export the business profile and currentWorkingPrompt as JSON.
- If the user clicks Push to GHL, push currentWorkingPrompt, not the original AI prompt.

---

## Regeneration Rules

If the user clicks Regenerate Prompt:

- Generate a new AI prompt.
- Do not destroy the prior AI-generated prompt.
- Do not destroy the user’s edited version.
- Show a confirmation before replacing the current working prompt.
- Allow the user to choose:
  - Replace current working prompt
  - Save new version separately
  - Cancel

---

## Review Warning

Show this warning above the final prompt editor:

AI-generated business information should be reviewed before using it in a live voice agent. Do not rely on AI-generated pricing, availability, legal claims, medical claims, financial claims, financial advice, guarantees, licenses, or credentials unless confirmed by the business.

---

## Backend Requirements

Use a Node/Express backend.

Required environment variable:

OPENAI_API_KEY

All OpenAI calls must happen server-side.

Never expose the OpenAI API key to the frontend.

---

## Required API Routes

### POST /api/enrich-business

Purpose:

Use OpenAI web search to research the business and generate a structured business profile and voice-agent prompt package.

Request body:

```json
{
  "businessName": "string",
  "websiteUrl": "string",
  "industry": "string",
  "agentGoal": "string",
  "tone": "string",
  "primaryCta": "string",
  "optionalNotes": "string",
  "ghlWidgetId": "string",
  "ghlVoiceAgentId": "string"
}
```

Response body:

```json
{
  "success": true,
  "businessProfile": {
    "businessName": "string",
    "websiteUrl": "string",
    "industry": "string",
    "summary": "string",
    "services": ["string"],
    "serviceArea": "string",
    "phone": "string",
    "hours": "string",
    "differentiators": ["string"],
    "customerTypes": ["string"],
    "commonQuestions": ["string"],
    "sourceNotes": [
      {
        "title": "string",
        "url": "string",
        "note": "string"
      }
    ],
    "unknowns": ["string"]
  },
  "voiceAgentPackage": {
    "agentName": "string",
    "agentRole": "string",
    "tone": "string",
    "conversationGoal": "string",
    "openingScript": "string",
    "qualificationQuestions": ["string"],
    "objectionHandlers": [
      {
        "objection": "string",
        "response": "string"
      }
    ],
    "escalationRules": ["string"],
    "bookingInstructions": "string",
    "complianceBoundaries": ["string"],
    "aiGeneratedPrompt": "string",
    "currentWorkingPrompt": "string"
  }
}
```

---

### POST /api/demos

Purpose:

Create a new demo record.

Request body should include:

- Business information
- AI-generated business profile
- AI-generated prompt
- Current working prompt
- GHL widget ID
- Optional GHL voice agent ID
- Status

---

### GET /api/demos

Purpose:

Return all saved demos for the logged-in user.

---

### GET /api/demos/:id

Purpose:

Return one demo.

---

### PUT /api/demos/:id

Purpose:

Update demo fields, including manually edited current working prompt.

Important:

When the user edits the final prompt, save it as:

currentWorkingPrompt

Do not overwrite:

aiGeneratedPrompt

---

### POST /api/demos/:id/regenerate

Purpose:

Regenerate the AI prompt using the saved business profile and updated user notes.

When regenerating:

- Preserve the prior user-edited prompt in version history.
- Generate a new AI prompt.
- Do not automatically overwrite user edits.
- Return the new prompt as a separate version.
- Allow the frontend to ask the user what to do with it.

---

### POST /api/demos/:id/copy-event

Purpose:

Log that the user copied the current working prompt.

---

### POST /api/demos/:id/export-markdown

Purpose:

Export the current working prompt as a Markdown file.

---

### POST /api/demos/:id/export-json

Purpose:

Export the business profile and voice-agent prompt package as JSON.

---

### POST /api/demos/:id/push-ghl

Purpose:

Placeholder for future GHL integration.

If GHL credentials are not configured, return:

```json
{
  "success": false,
  "message": "GHL push is not configured yet. Copy the final prompt and paste it manually."
}
```

---

## OpenAI Integration

Use the OpenAI Responses API.

Use OpenAI web search as the primary and only enrichment method for Version 1.

Do not scrape or parse the website directly.

The OpenAI call should use the web search tool.

Use required web search behavior so that enrichment does not rely only on model memory.

The OpenAI request should instruct the model to search the web using the business name and website URL.

---

## OpenAI System Instruction

Use this server-side instruction for the enrichment call:

```text
You are an expert AI voice-agent architect for local businesses, sales teams, and marketing agencies.

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
- If something is not found, return "unknown."
- If a fact is uncertain, include it in the unknowns array or mark it as low confidence.
- Keep the final prompt suitable for pasting into a GHL voice-agent instruction field.
- The voice agent should identify itself as an AI assistant if asked.
- The voice agent should ask one question at a time.
- The voice agent should escalate to a human for sensitive, uncertain, or out-of-scope questions.
- The tone should match the requested tone from the user.
- Return structured JSON only.
```

---

## OpenAI User Input Template

Send this as the user message:

```text
Research this business and generate a complete voice-agent prompt package.

Business Name: {{businessName}}
Website URL: {{websiteUrl}}
Industry: {{industry}}
Voice Agent Goal: {{agentGoal}}
Desired Tone: {{tone}}
Primary CTA: {{primaryCta}}
Optional Notes: {{optionalNotes}}

Return structured JSON only.
```

---

## Expected AI JSON Shape

The AI response should match this shape:

```json
{
  "businessProfile": {
    "businessName": "",
    "websiteUrl": "",
    "industry": "",
    "summary": "",
    "services": [],
    "serviceArea": "",
    "phone": "",
    "hours": "",
    "differentiators": [],
    "customerTypes": [],
    "commonQuestions": [],
    "sourceNotes": [
      {
        "title": "",
        "url": "",
        "note": ""
      }
    ],
    "unknowns": []
  },
  "voiceAgentPackage": {
    "agentName": "",
    "agentRole": "",
    "tone": "",
    "conversationGoal": "",
    "openingScript": "",
    "qualificationQuestions": [],
    "objectionHandlers": [
      {
        "objection": "",
        "response": ""
      }
    ],
    "escalationRules": [],
    "bookingInstructions": "",
    "complianceBoundaries": [],
    "aiGeneratedPrompt": "",
    "currentWorkingPrompt": ""
  }
}
```

---

## Final Voice Agent Prompt Format

The generated final prompt should use this structure:

```text
# Voice Agent Prompt for {{businessName}}

## Agent Identity

You are {{agentName}}, a friendly and professional AI voice assistant for {{businessName}}.

Your job is to help callers understand the company’s services, answer common questions, qualify the caller’s needs, and guide them toward {{primaryCta}}.

If asked, be honest that you are an AI assistant.

## Business Context

Business Name: {{businessName}}
Website: {{websiteUrl}}
Industry: {{industry}}
Location / Service Area: {{serviceArea}}
Phone: {{phone}}
Hours: {{hours}}

Business Summary:
{{businessSummary}}

Primary Services:
{{services}}

Target Customers:
{{customerTypes}}

Differentiators:
{{differentiators}}

## Conversation Goal

Your primary goal is to:

1. Greet the caller naturally.
2. Understand why they are calling.
3. Ask only the questions needed to qualify their request.
4. Provide helpful, accurate information based on the business profile.
5. Guide the caller toward {{primaryCta}}.
6. Escalate to a human when needed.

## Voice and Tone

Use a tone that is:

- {{tone}}
- Clear
- Conversational
- Helpful
- Not robotic
- Not overly pushy

Speak in short, natural sentences. Avoid long explanations unless the caller asks for more detail.

## Opening Script

{{openingScript}}

## Qualification Questions

Ask these only when relevant:

{{qualificationQuestions}}

## Service Guidance

Use the following service information when answering questions:

{{serviceDetails}}

Do not invent services, prices, guarantees, discounts, credentials, licenses, hours, service areas, or availability.

If something is unknown, say:

“I don’t want to give you the wrong information, but I can collect your details and have someone from the team follow up.”

## Objection Handling

{{objectionHandlers}}

## Escalation Rules

Escalate to a human if:

{{escalationRules}}

## Booking / CTA Instructions

Primary CTA:
{{primaryCta}}

Use this language:

“The best next step is {{ctaInstruction}}. I can help collect your information so the team can follow up.”

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

## Final Conversation Style

Keep responses brief and human-sounding.

Ask one question at a time.

Confirm important details before moving forward.

When uncertain, escalate to a human.
```

---

## Database Requirements

Create or update a table called:

demo_enrichments

Fields:

- id
- user_id
- business_name
- website_url
- industry
- agent_goal
- tone
- primary_cta
- optional_notes
- business_profile_json
- voice_agent_package_json
- ai_generated_prompt
- current_working_prompt
- final_saved_prompt
- edited_final_prompt
- prompt_versions_json
- source_notes_json
- unknowns_json
- ghl_widget_id
- ghl_voice_agent_id
- status
- created_at
- updated_at

Suggested statuses:

- draft
- enriched
- edited
- approved
- copied
- pushed_to_ghl
- failed

---

## Prompt Version History

Every time a prompt is generated or regenerated, save a version record.

Each version should include:

- version_id
- type
- prompt_text
- created_at
- notes

Version types:

- ai_generated
- user_edited
- regenerated
- final_saved

---

## Frontend Design Requirements

Use a clean SaaS-style interface.

Suggested layout:

- Left sidebar navigation
- Main content panel
- Demo cards on dashboard
- Form cards for input
- Result cards for AI output
- Large editor panel for final prompt

Design style:

- Modern
- Clean
- Agency-friendly
- Mobile responsive
- Easy to read
- Not cluttered

Suggested navigation:

- Dashboard
- Create Demo
- Saved Demos
- Settings

---

## Settings Page

Create a settings page with:

- OpenAI API status indicator
- Default tone
- Default CTA
- Default agency name
- Default GHL widget ID
- Optional GHL API placeholder settings
- Default disclaimer text

Do not expose secret keys in the frontend.

---

## Error Handling

If OpenAI enrichment fails, show:

“AI enrichment failed. Please try again or enter business details manually.”

If web search returns limited results, show:

“Limited public information was found. Please review the generated prompt carefully and add missing details before using it.”

If required fields are missing, require:

- Business Name
- Website URL
- Voice Agent Goal

If GHL push is unavailable, show:

“GHL push is not configured yet. You can copy the final prompt and paste it into your voice agent manually.”

---

## Security Requirements

- Never expose OPENAI_API_KEY to the frontend.
- All OpenAI calls must happen server-side.
- Validate required inputs.
- Validate URL format.
- Rate limit enrichment requests.
- Store prompt history safely.
- Do not include private API keys in exported files.
- Do not automatically update external systems without user action.

---

## Version 1 Exclusions

Do not build the following in Version 1:

- Website scraper
- Puppeteer crawler
- Cheerio parser
- Sitemap crawler
- Screenshot analyzer
- Browser automation
- Multi-page internal crawler
- Review scraper
- Social media scraper
- Automatic live GHL update without user action

These may be added later only if needed.

---

## Future Version Ideas

Later add:

- Direct GHL voice-agent update API
- GHL agent prompt version history
- Prompt scoring
- Industry templates
- Chat-widget prompt generation
- SMS follow-up generation
- Missed-call text-back generation
- Human review checklist
- Confidence scoring by field
- Source preview cards
- Side-by-side prompt versions
- Bulk demo creation from CSV
- Bulk demo creation from GHL contact list
- Agency-branded demo pages
- One-click demo links
- QR codes for demo pages
- Separate prompts for voice, chat, SMS, and email follow-up

---

## Final Build Goal

At the end of this build, the app should allow a user to:

1. Enter a business name and website URL.
2. Run OpenAI web search enrichment.
3. Generate a structured business profile.
4. Generate a ready-to-use voice-agent prompt.
5. Optionally edit the prompt.
6. Save the prompt.
7. Copy the prompt.
8. Export the prompt.
9. Prepare for future GHL push integration.

The core MVP should be:

Business name + website URL  
→ OpenAI web search  
→ generated business profile  
→ ready-to-use voice-agent prompt  
→ optional editing  
→ copy/save/export/push
