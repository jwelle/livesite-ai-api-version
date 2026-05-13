# Livesite AI Project Status

Last updated: May 12, 2026

## Current State

Livesite AI is on branch `codex/automation-api-v1-routes` and is pointed at the Supabase project `Live Site AI` (`qtxgrkhwspnmzncpvghd`).

- API server target: `http://localhost:8080`
- Frontend target: `http://localhost:8081`
- Supabase Auth is the intended auth path; Replit OIDC is legacy.
- Local secrets/config live in ignored `.env.local`; do not commit or print them.
- Portable Node and pnpm are available under ignored `.tools/`.
- Supabase public schema exists for app, auth-support, demo, and automation MVP tables.
- Signup/autofill handling is fixed locally.
- API admin route gating is scoped so non-admin API routes are no longer intercepted.
- External API MVP routes exist under `/api/v1/*` for API-key creation and demo-request creation.
- Automation API v1 route coverage now includes health, GHL connection management, and writeback tracking.
- Vercel configuration has been added for a frontend build plus Express API serverless handler.
- Public frontend demo route `/demo/:slug` is confirmed working locally in Chrome.
- API-created demos are stored in the main `demos` table, with `demo_requests` kept as audit/intake history.

## Active Project Plugins

- Browser: active for local `localhost` app verification in the in-app browser.
- Supabase: active and connected to project `qtxgrkhwspnmzncpvghd`.
- GitHub: active with access to `jwelle/livesite-ai-api-version`.
- Vercel: enabled for later deployment/project work.
- Canva: available through tool discovery, but not currently relevant.
- Game Studio: enabled in Codex config, but not relevant to this project slice.

Note: Codex app tools are available in-session even though the local `codex mcp list` command may report no CLI MCP servers.

## What Was Completed

- Local Supabase project URL and publishable key were added to `.env.local`.
- `DATABASE_URL` was updated for Supabase Postgres with SSL compatibility for Node `pg`.
- A disposable Supabase Auth test user was created and confirmed for local smoke testing.
- Authenticated API verification passed: the app created/loaded the user as the bootstrap admin.
- Authenticated dashboard API smoke tests passed for usage, settings, demo list/create, and admin users.
- Public demo API routing was fixed by mounting public routes before authenticated routers.
- Public demo API smoke test passed for the created test demo.
- Server auth code now expects Supabase Auth bearer tokens and verifies with Supabase JWKS, falling back to `SUPABASE_JWT_SECRET` only when needed.
- Frontend startup requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Signup no longer depends on React state alone, so browser/autofill values can submit successfully.
- `/api/openai-status` now returns without being blocked by the admin router.
- API-key creation and external demo-request creation smoke-tested successfully.
- External demo request with `options.enrich=false` created an active public demo URL and loaded through the public API.
- External demo request with `options.enrich=true` completed successfully and returned a public demo URL.
- API and frontend typechecks pass.
- API build passes and emits local + Vercel entrypoints.
- Frontend production build passes with local `PORT=8081` and `BASE_PATH=/`.
- Local API and frontend startup were re-verified on `http://localhost:8080` and `http://localhost:8081`, including `/api/healthz` through both origins.
- Public demo frontend route was verified manually in Chrome at `http://localhost:8081/demo/shoreline-roofing-u3d2`.
- Dashboard demo detail page UX was fixed:
  - `Copy Link` now uses async clipboard write and falls back to a clean toast instead of rendering a copy/read field.
  - `Open Public Demo` now opens the absolute `/demo/:slug` URL with popup-block fallback to same-tab navigation.
- Admin demos page UX was fixed:
  - `Open Public Demo` now uses the same resilient absolute URL open helper.
  - `View as owner` is disabled for self-owned demos so the UI no longer calls impersonation for the current admin user.
- Frontend typecheck passed after the dashboard/admin UX changes.
- Automation API v1 alignment was expanded:
  - added public `GET /api/v1/health`
  - kept API keys and demo requests under `/api/v1/*`
  - added authenticated GHL connection create/list/delete routes
  - added authenticated writeback tracking create/list routes
  - API-created demos now stamp source-tracking fields on `demos` while `demo_requests` remains an audit/intake record
- `.env.example` now documents `AUTOMATION_TOKEN_ENCRYPTION_KEY` for encrypted GHL token storage.
- Local automation API setup was completed and smoke-tested:
  - `GET /api/v1/health` returned `200`
  - authenticated API key create/list/revoke passed
  - missing and revoked API keys correctly returned `401` on `POST /api/v1/demo-requests`
  - authenticated GHL connection create/list/delete passed without exposing the private token
  - API-key demo creation produced a normal `demos` row plus a linked `demo_requests` row
  - public demo URL and `/api/public/demo/:slug` both returned `200`
  - authenticated writeback create/list passed
  - direct DB verification confirmed `createdVia`, `externalSource`, `apiKeyId`, and `externalSourceId` on the created demo
- Admin + user automation setup UI was added:
  - `/automation` for self-service API key and GHL connection management
  - `/admin/users/:userId/automation` for admin-managed tenant setup without impersonation
  - admin automation routes were added for target-user API key and GHL connection management
  - admin automation smoke test passed, including demo creation through an admin-managed API key for the target user
- Local `.env.local` now includes `AUTOMATION_TOKEN_ENCRYPTION_KEY` so GHL connection creation works without a temporary runtime override.

## Immediate Next Steps

1. Implement real outbound GHL writeback execution as a separate slice.
2. Browser-test the new `/automation` and `/admin/users/:userId/automation` pages interactively.
3. Confirm Supabase Auth redirect URLs include local and Vercel preview URLs.
4. Browser-test remaining authenticated dashboard flow:
   - create demo
   - edit settings/demo
   - run AI enrichment
   - publish as active
   - open `/demo/:slug`
5. Configure Vercel env vars and deploy a preview.
6. Add the deployed preview URL to Supabase Auth redirect URLs.
7. Add `AUTOMATION_TOKEN_ENCRYPTION_KEY` to preview/production environments.
8. Define GHL field-mapping and retry behavior for real writeback execution.

## Known Risks And Blockers

- Local dashboard testing depends on a real Supabase Auth user/session.
- If Supabase uses legacy symmetric JWTs, `SUPABASE_JWT_SECRET` may still be needed; current server code should work with JWKS first.
- External `/api/v1/demo-requests` currently supports page generation and optional enrichment, but not real GHL writeback execution.
- GHL writeback route coverage is tracking-only; it does not yet call the GoHighLevel API.
- OpenAI enrichment requires `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY`.
- Some Vite/esbuild/codegen commands can fail inside Codex's Windows sandbox with path access errors; run them in normal PowerShell or approve unrestricted execution when needed.
- Vercel preview still needs environment variables set and Supabase Auth redirect URLs updated.
- Clipboard behavior in the Codex in-app browser can differ from normal Chrome; the UI now handles that case with toast-based fallbacks instead of inline copy fields.
- Real GHL outbound writeback is still out of scope for this branch; the writeback routes only record attempts and metadata.
- GHL connection creation requires `AUTOMATION_TOKEN_ENCRYPTION_KEY` in every target environment or token storage will fail safely.

## Useful Commands

Start API:

```powershell
cd C:\Users\user\Documents\GitHub\livesite-ai-api\livesite-ai-api-code
.\scripts\local-api.cmd
```

Start frontend:

```powershell
cd C:\Users\user\Documents\GitHub\livesite-ai-api\livesite-ai-api-code
.\scripts\local-web.cmd
```

Verify health:

```powershell
curl http://localhost:8080/api/healthz
curl http://localhost:8081/api/healthz
```
