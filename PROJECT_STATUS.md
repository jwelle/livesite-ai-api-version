# Livesite AI Project Status

Last updated: May 10, 2026

## Current State

Livesite AI is on branch `codex/supabase-auth-migration-stabilization` and is pointed at the Supabase project `Live Site AI` (`qtxgrkhwspnmzncpvghd`).

- API server target: `http://localhost:8080`
- Frontend target: `http://localhost:8081`
- Supabase Auth is the intended auth path; Replit OIDC is legacy.
- Local secrets/config live in ignored `.env.local`; do not commit or print them.
- Portable Node and pnpm are available under ignored `.tools/`.
- Supabase public schema exists for app, auth-support, demo, and automation MVP tables.
- Signup/autofill handling is fixed locally.
- API admin route gating is scoped so non-admin API routes are no longer intercepted.
- External API MVP routes exist under `/api/v1/*` for API-key creation and demo-request creation.
- Vercel configuration has been added for a frontend build plus Express API serverless handler.

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

## Immediate Next Steps

1. Browser-test full user signup and login with a new real account.
2. Confirm Supabase Auth redirect URLs include local and Vercel preview URLs.
3. Browser-test manual dashboard flow:
   - create demo
   - edit settings/demo
   - run AI enrichment
   - publish as active
   - open `/demo/:slug`
4. Configure Vercel env vars and deploy a preview.
5. Add the deployed preview URL to Supabase Auth redirect URLs.
6. Add GHL connection/writeback endpoints after the page-generation loop is verified live.

## Known Risks And Blockers

- Local dashboard testing depends on a real Supabase Auth user/session.
- If Supabase uses legacy symmetric JWTs, `SUPABASE_JWT_SECRET` may still be needed; current server code should work with JWKS first.
- External `/api/v1/demo-requests` currently supports page generation and optional enrichment, but not GHL writeback.
- GHL writeback has not yet been tested with a real private integration token and contact id.
- OpenAI enrichment requires `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY`.
- Some Vite/esbuild/codegen commands can fail inside Codex's Windows sandbox with path access errors; run them in normal PowerShell or approve unrestricted execution when needed.
- Vercel preview still needs environment variables set and Supabase Auth redirect URLs updated.

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
