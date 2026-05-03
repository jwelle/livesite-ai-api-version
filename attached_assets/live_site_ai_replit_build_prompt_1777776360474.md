# Replit Build Prompt: Live Site AI

## Project Name

**Live Site AI**

## Product Positioning

**Live Site AI turns any business website into a live AI chat and voice demo.**

## Project Goal

Build a production-ready MVP web application that lets an agency create instant, personalized GoHighLevel demo pages for prospects.

Each demo page should:

1. Showcase the prospect’s company website.
2. Overlay a GoHighLevel chat widget using a configurable `data-widget-id`.
3. Allow the agency to swap chat personas by changing the widget ID globally or per demo.
4. Provide a separate call-to-action button for a GoHighLevel Voice AI demo phone number.
5. Generate a copyable Voice AI prompt for manual setup in HighLevel.
6. Track views, call clicks, calendar clicks, and website open clicks.
7. Be built with future multi-tenant SaaS expansion in mind.

The MVP should work without requiring the GoHighLevel Voice AI API or OpenAI API yet, but the codebase should be prepared for both.

---

# Core Concept

The user should be able to log in, create a prospect demo, enter the prospect’s company website, choose a chat widget/persona, add a Voice AI demo phone number, and generate a public demo URL.

The public demo page should make it feel like the prospect’s own website already has AI chat and voice automation installed.

The app should not modify, inject code into, or access the prospect’s actual website backend.

The GoHighLevel widget should be loaded on the generated demo page itself, not inside the prospect website iframe.

---

# High-Level User Flow

1. User signs up or logs in.
2. User opens the dashboard.
3. User clicks **Create Demo**.
4. User enters prospect details.
5. User selects or enters a GoHighLevel chat widget ID.
6. User enters a Voice AI demo phone number.
7. User saves the demo.
8. The app generates a public demo URL.
9. Prospect opens the demo URL.
10. Prospect sees their website preview with the GHL chat widget floating above it.
11. Prospect can click to call the Voice AI demo number.
12. App tracks views and clicks.

---

# Tech Stack

Use the following stack:

- Frontend: React + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL with Drizzle ORM
- Styling: Tailwind CSS
- Auth: Replit Auth if available, otherwise simple email/password auth
- Deployment: Replit-compatible
- Optional screenshot support: placeholder-friendly architecture for future Puppeteer or Playwright

Do not overcomplicate the MVP.

Prioritize:

- Working app
- Clean architecture
- Reliable routing
- Simple settings
- Configurable widget/persona system
- Professional demo page
- Mobile responsiveness

---

# Required Pages

Create the following pages:

1. Landing Page
2. Login / Signup Page
3. Admin Dashboard
4. Create Demo Page
5. Edit Demo Page
6. Demo Detail Page
7. Public Demo Preview Page
8. Settings Page

---

# 1. Landing Page

Create a polished SaaS-style landing page.

## Headline

**Turn Any Business Website Into a Live AI Demo**

## Subheadline

Create instant GoHighLevel-powered demos that show prospects how AI chat and Voice AI could work on their own website.

## Main CTA

**Create Your First Demo**

## Sections

### Hero

Include:

- Headline
- Subheadline
- CTA button
- Product mockup showing:
  - Website preview
  - Floating AI chat widget
  - “Call AI Voice Demo” button

### How It Works

Use three steps:

1. Enter a prospect website.
2. Choose a chat and voice demo persona.
3. Send the demo link and let them try it.

### Features

Include feature cards:

- Website preview
- GHL chat widget overlay
- Configurable chat personas
- Voice AI call button
- Demo library
- Agency branding
- View and click tracking
- Future-ready GHL API structure

### Footer

Include:

- Live Site AI
- Privacy
- Terms
- Contact

---

# 2. Authentication

Create basic authentication.

Users should be able to:

- Sign up
- Log in
- Log out
- Access protected dashboard pages only when logged in

For the MVP, use a simple user model.

## User Fields

- id
- name
- email
- password_hash if using password auth
- created_at
- updated_at

If Replit Auth is used, adapt the schema accordingly.

---

# 3. Admin Dashboard

Create a dashboard where the logged-in user can see all demos they have created.

## Dashboard Header

Title:

**Demo Dashboard**

Subtitle:

Manage your AI demo pages, prospect websites, chat personas, and Voice AI call experiences.

## Dashboard Metrics

Show summary cards:

- Total demos
- Active demos
- Total demo views
- Total call clicks
- Total calendar clicks

## Demo Table

Display demos in a table with columns:

- Company
- Website
- Industry
- Chat Persona
- Voice Persona
- Demo URL
- Status
- Views
- Call Clicks
- Created Date
- Actions

## Actions

Each row should include:

- View demo
- Edit
- Copy link
- Delete

---

# 4. Create Demo Page

Create a form to generate a new demo.

## Required Fields

- Company Name
- Website URL
- Industry
- Contact Name
- Contact Email
- Contact Phone
- Voice AI Phone Number
- CTA Calendar Link
- Demo Status

## Chat Persona Fields

Include:

- Chat Widget ID
- Chat Persona Name

These fields should allow the user to override the global default chat widget for this specific demo.

## Voice Persona Fields

Include:

- Voice Persona Name
- Voice AI Phone Number
- Voice AI Goal

Example voice persona names:

- General AI Receptionist
- Roofing AI Receptionist
- Mortgage AI Assistant
- Real Estate Intake Assistant
- Med Spa Booking Assistant
- Customer Support Assistant

## Optional Fields

- Company Description
- Services Offered
- Service Area
- Custom Demo Message
- Internal Notes

## Default Values

If no Voice AI phone number is entered, use the user’s default from settings.

If no settings default exists, use:

`+1-555-555-5555`

If no CTA calendar link is entered, use the user’s default from settings.

If no settings default exists, use:

`https://calendly.com/`

If no Chat Widget ID is entered, use the user’s default widget ID from settings.

If no settings default exists, use:

`69c5a088532eaeb30be7c36d`

## On Submit

When the form is submitted:

1. Validate the website URL.
2. Normalize the URL so it includes `https://` if missing.
3. Validate the phone number enough to safely use in a `tel:` link.
4. Validate the calendar URL.
5. Create a slug from the company name.
6. Save the demo to the database.
7. Redirect the user to the Demo Detail Page.
8. Generate a public demo URL like:

`/demo/acme-roofing`

If duplicate slugs exist, append a random short ID.

Example:

`/demo/acme-roofing-x92k`

---

# 5. Edit Demo Page

Allow users to update all demo fields.

The user should be able to change:

- Company Name
- Website URL
- Industry
- Contact information
- Chat Widget ID
- Chat Persona Name
- Voice Persona Name
- Voice AI Phone Number
- CTA Calendar Link
- Services Offered
- Service Area
- Custom Demo Message
- Internal Notes
- Status

Important:

- Updating the Chat Widget ID should immediately affect the public demo page.
- Updating the Voice AI Phone Number should immediately affect the public demo page.
- Do not create a new demo when editing.
- Preserve existing tracking data.

---

# 6. Demo Detail Page

Create a private admin detail page for each demo.

This page should show:

- Company name
- Website URL
- Industry
- Contact info
- Voice AI phone number
- Public demo URL
- View count
- Call click count
- Calendar click count
- Created date
- Updated date
- Notes

## Buttons

Include:

- Open Public Demo
- Copy Demo Link
- Edit Demo
- Delete Demo
- Regenerate Slug

---

# 7. Chat Widget / Persona Section

On the Demo Detail Page, create a section called:

**Active Chat Demo**

Show:

- Active Chat Persona Name
- Active Chat Widget ID
- Widget Source
- Public demo page script status

## Widget Source Logic

Show one of these:

- Demo Override
- Global Default
- Hardcoded Fallback

## Widget Resolution Order

The public demo page should resolve the chat widget ID in this order:

1. `demo.chat_widget_id`
2. `agency_settings.default_ghl_widget_id`
3. hardcoded fallback: `69c5a088532eaeb30be7c36d`

Example display:

```txt
Active Chat Persona: Roofing Demo Assistant
Widget Source: Demo Override
Widget ID: 69c5a088532eaeb30be7c36d
```

---

# 8. Generated Voice AI Prompt

On the Demo Detail Page, create a section called:

**Generated Voice AI Prompt**

Generate a basic prompt using the demo information.

Use this structure:

```md
# Role

You are the AI receptionist for {{company_name}}.

# Primary Goal

Answer inbound calls professionally, help the caller understand the business, qualify their need, and guide them toward booking an appointment or requesting a callback.

# Business Context

Business Name: {{company_name}}
Website: {{website_url}}
Industry: {{industry}}
Services: {{services_offered}}
Service Area: {{service_area}}
Phone: {{contact_phone}}
Voice Persona: {{voice_persona_name}}
Tone: Friendly, professional, concise

# Conversation Rules

- Sound natural and human.
- Keep answers short.
- Ask one question at a time.
- Do not invent services, pricing, or guarantees.
- If unsure, offer to have a team member follow up.
- Always try to capture name, phone, email, and reason for calling.

# Opening Message

Hi, thanks for calling {{company_name}}. This is the AI assistant for the team. I can help answer questions, take a message, or help get you pointed in the right direction. What can I help you with today?

# Qualification Questions

1. What service are you looking for?
2. Are you looking for help now or just gathering information?
3. What city or town are you located in?
4. What is the best phone number and email for follow-up?
5. Would you like someone from the team to contact you?

# Escalation

If the caller asks for a human, pricing, emergency service, legal, medical, financial advice, or something outside the known business information, collect their information and say a team member will follow up.
```

Allow the user to copy this prompt.

Do not connect to the GHL Voice AI API yet unless specifically requested later.

This MVP should prepare the data structure for future GHL API integration.

---

# 9. Public Demo Preview Page

Create a public route:

`/demo/:slug`

This is the page the prospect sees.

## Page Goal

The public demo page should feel like a live AI preview for the prospect’s own business website.

## Layout

Use a clean modern layout with:

### Fixed Top Demo Bar

Include:

- Company name
- Message: “Live AI Demo Preview”
- Button: “Call AI Voice Demo”
- Button: “Book Setup Call”

### Main Website Preview Area

Show the prospect website.

Use this hierarchy:

1. Try to show the website URL in an iframe.
2. If iframe fails or cannot load, show a fallback panel that says:

```txt
Website Preview

We created this AI demo for {{company_name}} using your website URL:

{{website_url}}

Some websites block live previews, but your AI chat and voice demo are still active on this page.
```

3. Include a button to open the actual website in a new tab.

## Important Iframe Rule

Many websites block iframe embedding.

Do not let that break the demo page.

If the iframe does not load cleanly, the page should still look professional.

---

# 10. Floating Demo Card

Overlay a floating card on the lower left or lower right of the public demo page.

## Card Title

**AI Assistant Demo**

## Card Copy

This preview shows how AI chat and Voice AI could help {{company_name}} answer questions, capture leads, and respond faster.

## Buttons

- Call AI Voice Demo
- Book Setup Call

## Call Button Behavior

The “Call AI Voice Demo” button should use:

`tel:{{voice_ai_phone_number}}`

When clicked:

1. Increment the `call_click_count`.
2. Store a `call_click` event.
3. Open the phone link.

## Book Call Button Behavior

The “Book Setup Call” button should open the CTA calendar link in a new tab.

When clicked:

1. Store a `calendar_click` event.
2. Open the calendar link.

---

# 11. GoHighLevel Chat Widget Embed

Every public demo page must include one GoHighLevel chat widget script.

The widget ID must be dynamic.

## Original Script Example

```html
<script src="https://beta.leadconnectorhq.com/loader.js" data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="69c5a088532eaeb30be7c36d"></script>
```

## Dynamic Script Requirement

Render the script like this:

```html
<script
  src="https://beta.leadconnectorhq.com/loader.js"
  data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js"
  data-widget-id="{{resolved_chat_widget_id}}">
</script>
```

## Critical Rules

- The `data-widget-id` value must not be permanently hardcoded.
- Store the default widget ID in settings.
- Allow each demo to override the widget ID.
- Only load one GHL chat widget script per public demo page.
- The widget script must load globally on the demo page.
- The widget script must not load inside the iframe.
- Do not inject this script into the prospect’s actual website.
- Do not treat the chat widget as the Voice AI agent.
- Chat demo and Voice AI demo are separate demo actions.

## Widget Resolution Order

Use this order:

```txt
demo.chat_widget_id
agency_settings.default_ghl_widget_id
hardcoded fallback: 69c5a088532eaeb30be7c36d
```

---

# 12. Settings Page

Create a settings page for agency branding and defaults.

## Fields

- Agency Name
- Agency Website
- Agency Logo URL
- Primary Brand Color
- Secondary Brand Color
- Default Voice AI Phone Number
- Default Voice Persona Name
- Default Calendar Link
- Default GHL Chat Widget ID
- Default Chat Persona Name

## Default GHL Chat Widget ID

Use:

`69c5a088532eaeb30be7c36d`

## Default Chat Persona Name

Use:

`General AI Assistant`

## Behavior

The settings page should let the user update global defaults.

New demos should use these defaults unless the user overrides them.

Existing demos should use settings defaults only if they do not have their own demo-level override.

---

# 13. Database Schema

Create database tables for:

## users

- id
- name
- email
- password_hash
- created_at
- updated_at

## agency_settings

- id
- user_id
- agency_name
- agency_website
- agency_logo_url
- primary_brand_color
- secondary_brand_color
- default_voice_ai_phone
- default_voice_persona_name
- default_calendar_link
- default_ghl_widget_id
- default_chat_persona_name
- created_at
- updated_at

## demos

- id
- user_id
- company_name
- slug
- website_url
- industry
- contact_name
- contact_email
- contact_phone
- voice_ai_phone_number
- voice_persona_name
- voice_ai_goal
- cta_calendar_link
- chat_widget_id
- chat_persona_name
- company_description
- services_offered
- service_area
- custom_demo_message
- internal_notes
- status
- view_count
- call_click_count
- calendar_click_count
- created_at
- updated_at

## demo_events

- id
- demo_id
- event_type
- event_data
- ip_address
- user_agent
- created_at

## Event Types

Use these event types:

- view
- call_click
- calendar_click
- website_open_click
- copy_link

---

# 14. API Routes

Create the following backend routes.

## Auth Routes

- POST `/api/auth/signup`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`

## Demo Routes

- GET `/api/demos`
- POST `/api/demos`
- GET `/api/demos/:id`
- PATCH `/api/demos/:id`
- DELETE `/api/demos/:id`
- POST `/api/demos/:id/regenerate-slug`

## Public Demo Routes

- GET `/api/public/demo/:slug`
- POST `/api/public/demo/:slug/view`
- POST `/api/public/demo/:slug/call-click`
- POST `/api/public/demo/:slug/calendar-click`
- POST `/api/public/demo/:slug/website-open-click`

## Settings Routes

- GET `/api/settings`
- PATCH `/api/settings`

---

# 15. UI Design Requirements

Use a modern SaaS style.

## Visual Style

- Clean layout
- Rounded cards
- Light background
- Dark navy text
- Blue and purple accents
- Responsive mobile-first design
- Smooth hover states
- Clear CTA buttons

## Suggested Colors

- Primary: `#2563eb`
- Secondary: `#7c3aed`
- Dark: `#0f172a`
- Light background: `#f8fafc`
- Card background: `#ffffff`
- Border: `#e2e8f0`

## Components

Create reusable components:

- AppLayout
- PublicDemoLayout
- DashboardCard
- DemoTable
- DemoForm
- CopyButton
- PhoneCallButton
- WebsitePreviewFrame
- FloatingDemoCard
- GeneratedPromptBox
- SettingsForm
- ChatWidgetStatusCard
- PersonaSelector

---

# 16. Website Preview Component

Create a robust `WebsitePreviewFrame` component.

## Props

- websiteUrl
- companyName

## Behavior

1. Render the website in an iframe.
2. Add a timeout fallback.
3. If the iframe fails, show a clean fallback.
4. Always include “Open Website in New Tab.”
5. Do not allow iframe failure to break the page.

## Fallback Copy

Use:

```txt
Live website preview may be blocked

Some websites prevent third-party previewing for security reasons. The AI demo is still active here, and you can open the website directly below.
```

Button:

**Open Website**

---

# 17. Future GHL API Preparation

Do not fully implement GHL Voice AI API calls yet.

But prepare the codebase so this can be added later.

Create a service file:

`server/services/ghlService.ts`

Include placeholder functions:

```ts
export async function createVoiceAgent(config: any) {
  throw new Error("GHL Voice AI API integration not implemented yet.");
}

export async function updateVoiceAgent(agentId: string, config: any) {
  throw new Error("GHL Voice AI API integration not implemented yet.");
}

export async function getVoiceAgent(agentId: string) {
  throw new Error("GHL Voice AI API integration not implemented yet.");
}

export async function getCallLogs(agentId: string) {
  throw new Error("GHL Voice AI call log integration not implemented yet.");
}

export async function createOrUpdateChatWidgetPersona(config: any) {
  throw new Error("GHL Chat Widget API integration not implemented yet.");
}
```

Create environment variable placeholders:

```env
GHL_API_KEY=
GHL_LOCATION_ID=
GHL_WEBHOOK_SECRET=
```

Add a note in the settings page:

```txt
GHL Voice AI API integration is prepared but not active in this MVP. For now, paste your Voice AI phone number and generated prompt into HighLevel manually.
```

---

# 18. Future OpenAI Preparation

Do not require OpenAI for the MVP.

But prepare a service file:

`server/services/aiPromptService.ts`

Add a function:

```ts
export function generateVoiceAIPrompt(demo: Demo) {
  return `...`;
}
```

This should generate the Voice AI prompt from stored demo fields.

Later, this can be replaced with OpenAI Responses API.

Add environment variable placeholder:

```env
OPENAI_API_KEY=
```

Use the Responses API terminology in comments, not Assistants API.

Do not build anything around the deprecated Assistants API.

---

# 19. Public Demo Tracking

When someone opens a public demo page:

1. Increment view count.
2. Store a `view` event in `demo_events`.

When someone clicks the call button:

1. Increment call click count.
2. Store a `call_click` event.

When someone clicks calendar:

1. Increment calendar click count.
2. Store a `calendar_click` event.

When someone clicks open website:

1. Store a `website_open_click` event.

Make sure tracking does not block the user experience.

---

# 20. Copy Link Feature

On dashboard and demo detail pages, include a copy link button.

When clicked:

- Copy full public demo URL to clipboard.
- Show toast: “Demo link copied.”
- Log copy event if practical.

---

# 21. Error Handling

Add friendly error states for:

- Invalid URL
- Missing company name
- Demo not found
- Unauthorized dashboard access
- Database error
- Iframe blocked
- Missing phone number
- Missing calendar link
- Missing chat widget ID
- Invalid chat widget ID format

---

# 22. Security

Basic MVP security requirements:

- Protected dashboard routes
- Public demo pages are read-only
- Do not expose API keys to frontend
- Sanitize website URLs
- Validate phone links
- Validate calendar links
- Prevent users from editing demos they do not own
- Do not allow arbitrary script injection from user input
- Only the controlled GHL loader script should be rendered
- Only the `data-widget-id` should be dynamic

---

# 23. Seed Data

Create sample demo data if the database is empty.

Example:

```txt
Company Name: Shoreline Roofing
Website URL: https://example.com
Industry: Roofing
Chat Persona Name: Roofing Demo Assistant
Chat Widget ID: 69c5a088532eaeb30be7c36d
Voice Persona Name: Roofing AI Receptionist
Voice AI Phone Number: +1-555-555-5555
Calendar Link: https://calendly.com/
```

---

# 24. Acceptance Criteria

The MVP is complete when:

1. A user can sign up and log in.
2. A user can create a new demo.
3. A public demo URL is generated.
4. The public demo page shows the prospect website in an iframe or fallback panel.
5. The GHL chat widget loads on the public demo page.
6. The chat widget ID is stored in settings.
7. Each demo can optionally override the chat widget ID.
8. The public demo page loads the widget using the resolved widget ID.
9. Only one widget script is loaded per public demo page.
10. The user can swap chat personas by changing the widget ID.
11. The app clearly shows which widget/persona is active for each demo.
12. The call button uses the configured Voice AI phone number.
13. The dashboard shows created demos.
14. Views and call clicks are tracked.
15. The generated Voice AI prompt is displayed and copyable.
16. Settings allow agency branding and default widget configuration.
17. The app is responsive on desktop and mobile.
18. The app is clean enough to use as a client-facing MVP.
19. The app prepares for future GHL Voice AI API integration without requiring it now.
20. The app prepares for future OpenAI Responses API support without requiring it now.

---

# 25. Important Build Notes

Do not spend excessive time trying to bypass iframe restrictions.

If a website blocks iframe embedding, use the fallback view.

Do not attempt to inject scripts into third-party websites.

Do not build around the OpenAI Assistants API.

Prepare for future OpenAI Responses API support, but keep this MVP functional without OpenAI.

Prepare for future GoHighLevel Voice AI API integration, but keep this MVP functional with manual phone number and prompt setup.

The primary goal is a working, attractive, reliable demo generator that can be used immediately for sales conversations.

The chat widget and voice demo should remain separate demo layers:

```txt
Chat Demo Layer = data-widget-id / chat persona
Voice Demo Layer = voice phone number / voice persona / generated prompt
```

---

# 26. Final Output Expected From Replit

When finished, provide:

1. A working Replit app.
2. Clear instructions for running the app.
3. Any environment variables needed.
4. A short explanation of where the GHL widget script is loaded.
5. A short explanation of how to create the first demo.
6. A note that Voice AI API integration is prepared but not active yet.
7. A note explaining how chat personas are swapped using the configurable widget ID.

---

# Follow-Up Prompt After First Build

Use this after Replit finishes the first build.

```md
Now review the app for broken routes, missing imports, TypeScript errors, database schema issues, and broken UI states.

Do not redesign the app.

Only fix bugs required to make the MVP work.

Confirm that:

1. Login works.
2. Dashboard loads.
3. Create Demo works.
4. Edit Demo works.
5. Public demo page loads.
6. GoHighLevel widget script is present on the public demo page.
7. The widget script uses the resolved widget ID.
8. Only one widget script loads per public demo page.
9. Call button uses the configured phone number.
10. Website iframe fallback works.
11. View and click tracking works.
12. Settings update the default widget ID and default persona fields.
13. Demo-level widget overrides work.
```

---

# Optional Second-Phase Prompt

Use this after the MVP is stable.

```md
Add a lightweight website summarizer feature.

When creating a demo, fetch the prospect website homepage server-side and extract:

1. Page title
2. Meta description
3. Main headings
4. Likely services
5. Likely location or service area if visible

Store these fields in the demo record.

Use the extracted information to improve the generated Voice AI prompt.

Do not require OpenAI yet.

Use basic HTML parsing first.

If the website cannot be fetched, fail gracefully and allow the user to manually enter services and description.
```

---

# Optional Third-Phase Prompt

Use this after the website summarizer is stable.

```md
Add OpenAI Responses API support for improving the generated Voice AI prompt.

Use the existing extracted website data and demo fields.

Do not use the deprecated Assistants API.

Add a settings field for enabling or disabling AI prompt generation.

If OPENAI_API_KEY is not present, keep the current template-based prompt system working.

The AI-generated prompt should be editable and saved to the demo record.
```

---

# Optional Fourth-Phase Prompt

Use this after manual GHL setup is validated.

```md
Begin implementing GoHighLevel Voice AI API integration.

Add fields for:

- GHL API key
- GHL location ID
- GHL agent ID
- GHL phone number ID

Keep credentials secure and server-side only.

Add buttons on the Demo Detail Page:

- Create Voice Agent in GHL
- Update Voice Agent in GHL
- Pull Call Logs
- Pull Transcript

Do not expose API keys in the frontend.

Do not remove manual setup functionality.
```
