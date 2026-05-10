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
- Backend automation MVP routes are the next missing backend slice on this branch.

## Immediate Next Steps

1. Use the disposable local test user to continue browser-level dashboard testing.
2. Add or port automation `/api/v1/*` routes onto this branch, then smoke-test:
   - API key lifecycle
   - GHL connection create/list without token leakage
   - demo request creation via API key
   - writeback attempt records
3. Add dashboard automation pages after backend routes are present.

## Known Risks And Blockers

- Local dashboard testing depends on a real Supabase Auth user/session.
- If Supabase uses legacy symmetric JWTs, `SUPABASE_JWT_SECRET` may still be needed; current server code should work with JWKS first.
- Automation `/api/v1/*` routes are not mounted on this branch yet; current smoke checks return 404.
- GHL writeback has not yet been tested with a real private integration token and contact id.
- OpenAI enrichment requires `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY`.
- Some Vite/esbuild/codegen commands can fail inside Codex's Windows sandbox with path access errors; run them in normal PowerShell or approve unrestricted execution when needed.

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
