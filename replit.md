# Live Site AI — Workspace

## Overview

pnpm workspace monorepo. Full-stack SaaS that lets agencies create GHL-powered AI demo pages for prospects. Each demo embeds a prospect's website in an iframe, overlays a floating GHL chat widget, and provides a "Call AI Voice Demo" button.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (wouter routing, shadcn/ui, TanStack Query)
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → React hooks + Zod schemas)
- **Auth**: Replit OIDC (via `@workspace/replit-auth-web`)
- **Build**: esbuild (API server CJS bundle)

## Workspace Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/api-server` | `artifacts/api-server` | Express API — auth, demos CRUD, public demo, settings |
| `@workspace/live-site-ai` | `artifacts/live-site-ai` | React+Vite frontend SaaS app |
| `@workspace/db` | `lib/db` | Drizzle ORM schema + db client |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec source of truth |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated TanStack Query hooks |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod validators for API routes |
| `@workspace/replit-auth-web` | `lib/replit-auth-web` | `useAuth()` hook for browser (login/logout/user) |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- After codegen: manually fix `lib/api-zod/src/index.ts` to only contain `export * from "./generated/api"`

## Database Schema

- `sessions` — Replit OIDC session storage
- `users` — authenticated users (id, email, firstName, lastName, profileImageUrl)
- `agency_settings` — per-user defaults (widget ID, voice phone, calendar link, persona names, branding)
- `demos` — prospect demo pages (company info, GHL widget ID, voice AI config, analytics counters)
- `demo_events` — event log (view, call_click, calendar_click, website_open_click)

## API Routes (all under `/api`)

### Auth
- `GET /auth/user` — current user
- `GET /login` — begin OIDC flow
- `GET /login/callback` — OIDC callback
- `GET /logout` — clear session

### Demos (authenticated)
- `GET /demos` — list all demos for user (seeds 1 demo if empty)
- `POST /demos` — create demo
- `GET /demos/:id` — get demo
- `PATCH /demos/:id` — update demo
- `DELETE /demos/:id` — delete demo
- `POST /demos/:id/regenerate-slug` — new unique slug
- `GET /dashboard/stats` — totalDemos, activeDemos, totalViews, totalCallClicks, totalCalendarClicks

### Settings (authenticated)
- `GET /settings` — get/create agency settings
- `PATCH /settings` — update settings

### Public (no auth)
- `GET /public/demo/:slug` — public demo data + resolved chat widget ID
- `POST /public/demo/:slug/view` — track view
- `POST /public/demo/:slug/call-click` — track call click
- `POST /public/demo/:slug/calendar-click` — track calendar click
- `POST /public/demo/:slug/website-open-click` — track website open click

## Frontend Pages

- `/` — Landing page (marketing, hero, features, how-it-works, CTA)
- `/login` — Single "Log in" button (calls Replit OIDC — no form)
- `/dashboard` — Metrics + demos table with actions
- `/demos/new` — Create demo form
- `/demos/:id/edit` — Edit demo form
- `/demos/:id` — Demo detail + voice AI prompt generator
- `/settings` — Agency settings form
- `/demo/:slug` — **Public demo page** (no auth): iframe + GHL chat widget + floating card + tracking

## Widget ID Resolution

1. `demo.chatWidgetId` (demo-level override)
2. `agencySettings.defaultGhlWidgetId` (global default)
3. Hardcoded fallback: `69c5a088532eaeb30be7c36d`

## GHL Chat Widget

Injected via `useEffect` in public-demo page:
```js
script.src = "https://beta.leadconnectorhq.com/loader.js"
script.setAttribute("data-resources-url", "https://beta.leadconnectorhq.com/chat-widget/loader.js")
script.setAttribute("data-widget-id", resolvedChatWidgetId)
```

## Notes

- GHL Voice AI API integration is **prepared but not active** — prompt generation works, but API calls to GHL are stubs. Agency pastes the generated prompt into HighLevel manually.
- Seed data: one demo is auto-created for new users on first `/demos` load.
- All public demo tracking is unauthenticated and uses slug-based lookup.

## OpenAI enrichment (Task #15)

- Server-only OpenAI Responses API + `web_search` tool. **No website scraping.** `OPENAI_API_KEY` server-side only.
- Endpoints under `/api`: `enrich-business`, `demos/:id/{enrich,regenerate,copy-event,export-markdown,export-json,push-ghl}`, `openai-status`. In-memory 5/min/user rate limit on enrich + regenerate.
- DB additions: `demos.{industry, voiceAgentGoal, desiredTone, primaryCta, disclaimer, businessProfile, suggestedPackage, aiGeneratedPrompt, currentWorkingPrompt, sources, ghlPushStatus}`; `agency_settings.{defaultTone, defaultPrimaryCta, defaultDisclaimer}`; new `prompt_versions` table.
- PATCH `/demos/:id` writes `currentWorkingPrompt` only. `aiGeneratedPrompt` is preserved across edits and updated only by enrich/regenerate. Regenerate appends a `prompt_versions` row of type `regenerated` and offers save/regenerate/cancel from the editor.
- Frontend export uses generated client URL helpers (`getExportDemoMarkdownUrl`, `getExportDemoJsonUrl`).
