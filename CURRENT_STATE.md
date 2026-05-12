# Livesite AI Current State

Last updated: May 12, 2026

## Active Branch

- Branch: `codex/supabase-auth-migration-stabilization`
- Local frontend: `http://localhost:8081`
- Local API: `http://localhost:8080`
- Supabase project: `Live Site AI` (`qtxgrkhwspnmzncpvghd`)

## Confirmed Working

- Public frontend demo route works at `/demo/:slug`.
- Public demo API remains available through `/api/public/demo/:slug`.
- Manual Chrome verification passed for:
  - `http://localhost:8081/demo/shoreline-roofing-u3d2`
  - prospect website background still rendering on the public demo page
- Dashboard demo detail UX fixes are in place:
  - `Copy Link` now attempts clipboard copy and falls back to a clean toast when the browser blocks clipboard access
  - `Open Public Demo` now uses a resilient `window.open(..., "noopener,noreferrer")` flow with same-tab fallback
- Admin demos UX fixes are in place:
  - `Open Public Demo` now uses the same resilient absolute-URL open helper
  - `View as owner` is disabled for self-owned demos so the UI no longer triggers the expected self-impersonation `HTTP 400`

## Important Notes

- Do not refactor public demo routing or Supabase Auth unless a new issue proves they are involved.
- The recent public demo issue was not the route itself; the remaining problems were dashboard/admin browser UX behaviors.
- Local app servers are currently expected to run on `8080` and `8081` for manual verification.

## Next Likely Focus

1. Continue browser-testing authenticated dashboard flows.
2. Confirm Supabase Auth redirect URLs for local plus Vercel preview environments.
3. Move on to Vercel preview deployment and env validation once local UX is stable.
