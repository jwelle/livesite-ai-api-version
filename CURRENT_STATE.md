# Livesite AI Current State

Last updated: May 12, 2026

## Active Branch

- Branch: `codex/automation-api-v1-routes`
- Local frontend: `http://localhost:8081`
- Local API: `http://localhost:8080`
- Supabase project: `Live Site AI` (`qtxgrkhwspnmzncpvghd`)

## Confirmed Working

- Public frontend demo route works at `/demo/:slug`.
- Public demo API remains available through `/api/public/demo/:slug`.
- Manual Chrome verification passed for:
  - `http://localhost:8081/demo/shoreline-roofing-u3d2`
  - prospect website background still rendering on the public demo page
- Automation API v1 routes are live under `/api/v1/*`:
  - `GET /api/v1/health`
  - API key create/list/revoke
  - demo request create/list/detail
  - GHL connection create/list/delete
  - writeback create/list
- Automation setup UI now exists on both surfaces:
  - `/automation` for self-service user setup
  - `/admin/users/:userId/automation` for admin-managed tenant setup
- Automation smoke test passed end to end:
  - authenticated API key create/list/revoke
  - API-key demo creation into the normal `demos` table
  - `demo_requests.demoId` link confirmed
  - `demos.createdVia`, `externalSource`, `apiKeyId`, and `externalSourceId` confirmed
  - public URL returned and loaded without login
  - GHL token metadata returned without exposing the token
  - writeback tracking create/list confirmed
  - admin-managed API key and GHL connection flow also passed for a target user

## Important Notes

- `demos` is the owned source of truth for API-created demos.
- `demo_requests` remains an audit/intake record, not a second ownership model.
- `AUTOMATION_TOKEN_ENCRYPTION_KEY` is now required in any environment that should support GHL connection creation.
- Real outbound GHL writeback is still intentionally out of scope in this slice; writebacks currently record attempts and metadata only.

## Next Likely Focus

1. Implement real outbound GHL writeback execution as a separate slice.
2. Confirm Supabase Auth redirect URLs include local and Vercel preview URLs.
3. Deploy a Vercel preview and set the new automation env var there.
