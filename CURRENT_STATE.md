# Livesite AI Current State

Last updated: May 14, 2026

## Current Branch

- Branch: `codex/automation-api-v1-routes`

## Current Preview URL

- Git-backed Vercel Preview: `https://livesite-ai-api-code-8uivu656h-jonathanwelle-2090s-projects.vercel.app`

## Current Production URL

- Production alias: `https://livesite-ai-api-code.vercel.app`

## Confirmed Working

- Branch `codex/automation-api-v1-routes` is pushed and tracking `origin/codex/automation-api-v1-routes`.
- Commit `ae57589 Add external test endpoint` added `POST /api/v1/external-test`.
- Empty commit `12cce32 Trigger Vercel preview redeploy` created the fresh Preview with current env vars.
- Branch-scoped Vercel Preview env vars exist for:
  - `SUPABASE_URL`
  - `DATABASE_URL`
  - `AUTOMATION_TOKEN_ENCRYPTION_KEY`
  - `EXTERNAL_TEST_SECRET`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Git-backed Preview health check succeeds:
  - `GET /api/v1/health` returned `{"status":"ok","service":"automation-api","version":"v1"}`
- Production alias health check succeeds:
  - `GET https://livesite-ai-api-code.vercel.app/api/v1/health` returned `200`.
  - Response body: `{"status":"ok","service":"automation-api","version":"v1"}`
- Production `DATABASE_URL` issue was resolved by adding the correctly named uppercase env var:
  - `DATABASE_URL`
- Production uses the Supabase Transaction Pooler `DATABASE_URL` on port `6543`.
- Temporary external test endpoint succeeds:
  - `POST /api/v1/external-test` returned `200 OK` from Express with `ok: true`.
  - Vercel Deployment Protection bypass header works.
  - Zapier successfully reached `POST /api/v1/external-test`.
  - GoHighLevel Custom Webhook successfully reached `POST /api/v1/external-test`.
  - External webhook reachability is now proven.
- Supabase password auth succeeds for the test user.
- Production `GET /api/auth/user` returns `200` from Express with the app user payload.
- Production `POST /api/v1/api-keys` returns `201`.
- No current nested Drizzle/Postgres error appears in logs for `findExistingUserByClaims()`.
- Local Supabase database contains `public.users`.
- Required `users` columns exist:
  - `id`
  - `supabase_auth_user_id`
  - `email`
  - `first_name`
  - `last_name`
  - `profile_image_url`
  - `role`
  - `status`
  - `tier`
  - `last_login_at`
  - `created_at`
  - `updated_at`

## Current Blocker

- Production API recovery is confirmed.
- External reachability is no longer blocked.
- Supabase-backed app user lookup is no longer blocked in Production.
- API-key creation is no longer blocked in Production.
- Next unverified real automation flow is `POST /api/v1/demo-requests` using the generated API key privately.

## Important Notes

- The earlier stale Preview URL was tied to an older commit and should not be used for testing.
- The working Preview external-test URL used during testing was:
  - `https://livesite-ai-api-code-8uivu656h-jonathanwelle-2090s-projects.vercel.app/api/v1/external-test`
- Production alias should be used for Production health checks:
  - `https://livesite-ai-api-code.vercel.app`
- Direct deployment URLs may be behind Vercel Authentication.
- The Vercel bypass secret used during testing should be rotated.
- The temporary Supabase test user password should be rotated or deleted when testing is complete.
- The temporary `/api/v1/external-test` route should be removed before final production hardening unless intentionally retained behind proper auth.

## Next Recommended Step

1. Use the generated API key privately to test `POST /api/v1/demo-requests`.
2. Do not print API key values, tokens, passwords, `DATABASE_URL`, or other secrets during testing.
