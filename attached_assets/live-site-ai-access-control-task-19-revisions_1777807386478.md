# Live Site AI Task #19 Revisions: Access Control, Invite Links, Free Tier Limits, and Admin User Control

## Purpose

This document provides the final requested revisions to the Replit agent's Task #19 plan for Live Site AI access control.

The original task plan is approved in concept. Please proceed with implementation, but apply the refinements below before coding.

The main goal is to protect the app from unrestricted public usage while avoiding full billing/subscription implementation for now.

---

# Final Access Model

Implement the following access control model:

| User Status | Tier | Access Level |
|---|---|---|
| `pending_approval` | `free` by default | No app access beyond pending screen and logout |
| `active` | `free` | Limited trial access, 1 demo total |
| `active` | `pro` | Approved access, no demo cap for now, 25 enrichments per day |
| `active` | `admin` or role `admin` | Full administrative access |
| `suspended` | any | Blocked from app access |

---

# 1. Keep the Tier Model Simple

Use the following tier model:

```ts
tier: "free" | "pro"
```

This is acceptable even though billing is out of scope for now.

Reason:

- `free` clearly represents the limited trial user.
- `pro` can later map cleanly to a Stripe or other paid subscription plan.
- We do not need a separate `approved` tier if status and tier are handled correctly.

Do not build billing or Stripe in this task.

---

# 2. Pending Users Are Not Free Users Yet

A user may technically have:

```ts
status: "pending_approval"
tier: "free"
```

However, this user should not receive free-tier app access.

Free-tier access only applies when:

```ts
status === "active" && tier === "free"
```

Pending users should be blocked from:

- Dashboard
- Demo creation
- Existing demos
- Settings
- AI enrichment
- Prompt generation
- Regenerate actions
- Publishing actions
- Any backend route that creates cost or modifies data

Pending users should only be allowed to access:

- Pending approval screen
- Account status endpoint
- Logout
- Basic auth/session routes needed for the pending page

---

# 3. User Status Model

Use or extend the user status model as follows:

```ts
status: "pending_approval" | "active" | "suspended"
```

Optional, only if clean and easy:

```ts
status: "pending_approval" | "active" | "suspended" | "rejected"
```

If adding `rejected` creates unnecessary migration complexity, use `suspended` for rejected users and audit-log the action as `user_rejected`.

---

# 4. Role Model

Use the existing role model or add:

```ts
role: "user" | "admin"
```

Admin access should require:

```ts
status === "active" && role === "admin"
```

Do not rely on frontend route hiding for admin security.

Admin-only routes must be protected server-side.

---

# 5. Approval Behavior

In `/admin/users`, keep the following actions:

- Approve as Free
- Approve as Pro
- Reject
- Suspend
- Reactivate
- Change Tier
- Change Role

When an admin clicks **Approve as Free**:

```ts
status = "active"
tier = "free"
role = "user"
```

When an admin clicks **Approve as Pro**:

```ts
status = "active"
tier = "pro"
role = "user"
```

When an admin upgrades a user to admin:

```ts
status = "active"
role = "admin"
tier = "pro"
```

---

# 6. Reject Behavior

Do not delete rejected users.

If using only the three-status model, Reject should set:

```ts
status = "suspended"
```

And audit-log the action as:

```ts
user_rejected
```

If adding a fourth status is easy, use:

```ts
status = "rejected"
```

Either way, rejected users should not be able to access the app.

---

# 7. Free Tier Limit

Free active users are limited to:

```env
FREE_USER_TOTAL_DEMOS=1
```

Behavior:

- Active free users can create only 1 demo total.
- The backend must reject demo creation when the user has already created 1 demo.
- The frontend should disable or hide the New Demo action when the limit is reached.
- The API must still enforce the rule server-side.

Recommended user-facing message:

```txt
You’ve reached the free demo limit. Please request approval to continue creating demos.
```

Recommended API error code:

```txt
FREE_DEMO_LIMIT_REACHED
```

---

# 8. Pro Tier Limit

Pro users should have:

```env
PRO_USER_DAILY_ENRICHMENTS=25
```

For now, free and pro users can both share the same daily enrichment cap of 25 if that is simpler.

However:

- Free users are still limited to 1 demo total.
- Pro users have no total demo cap for now.
- Admin users can bypass normal usage caps.

Recommended API error code:

```txt
DAILY_ENRICHMENT_LIMIT_REACHED
```

Recommended user-facing message:

```txt
You’ve reached your daily enrichment limit. Please contact support if you need more access.
```

---

# 9. Daily Enrichment Reset Timezone

Preferred reset timezone:

```txt
America/New_York
```

Use America/New_York for the daily enrichment reset if practical.

If UTC is materially simpler, UTC is acceptable, but the UI must clearly say:

```txt
Resets at midnight UTC.
```

Do not leave the reset time ambiguous.

---

# 10. Usage Tracking

Track usage in a way that survives server restarts.

At minimum, track:

- Demo creation count per user
- Enrichment count per user per day
- Total enrichment count per user
- Invite creation and consumption
- Admin approval and tier changes

A daily usage table is acceptable:

```ts
daily_usage {
  id
  user_id
  date
  enrichment_count
  created_at
  updated_at
}
```

A usage event table is also acceptable:

```ts
usage_events {
  id
  user_id
  event_type
  metadata
  created_at
}
```

If using event logs, make sure daily counts can be queried efficiently.

Usage checks must happen before expensive actions.

For enrichment, avoid consuming quota when the request is rejected.

---

# 11. Backend Enforcement Is Mandatory

Frontend route hiding is not enough.

The backend must enforce all restrictions.

Protect at minimum:

- Demo creation
- Demo editing
- Demo publishing
- AI enrichment
- Regenerate
- Prompt generation
- Settings updates
- Widget/persona updates
- Admin routes
- Any OpenAI call
- Any future endpoint that can trigger AI cost or modify app data

Suggested helpers or middleware:

```ts
requireAuthenticatedUser
requireActiveUser
requireAdmin
checkCanCreateDemo
checkCanRunEnrichment
checkUserTierLimit
```

Rules:

```ts
pending_approval = blocked
suspended = blocked
active + free = 1 demo total, capped enrichment
active + pro = uncapped demos for now, 25 enrichments/day
active + admin = full access
```

---

# 12. Invite Link Behavior

Admins should be able to generate one-time invite links.

Example:

```txt
/signup?invite=<token>
```

Invite links should support:

- Unique token
- One-time use
- Tier selection: `free` or `pro`
- Optional expiration
- Optional invited email
- Created by admin user ID
- Created timestamp
- Consumed timestamp
- Consumed by user ID
- Revoked timestamp if revoked
- Audit log on creation
- Audit log on consumption

Recommended table:

```ts
user_invites {
  id
  token
  tier
  invited_email
  created_by
  created_at
  expires_at
  consumed_at
  consumed_by_user_id
  revoked_at
}
```

A valid invite must be:

- Not expired
- Not revoked
- Not already consumed
- Matching the invited email if `invited_email` is populated

If `invited_email` is blank, any email can use the invite link.

When an invite link is successfully used:

```ts
status = "active"
tier = selected invite tier
role = "user"
```

Then consume the token so it cannot be reused.

If the invite is invalid, expired, already used, or revoked, the user should continue through the normal signup path and land in:

```ts
status = "pending_approval"
tier = "free"
role = "user"
```

---

# 13. Manual User Creation

Admins should be able to manually add a user from `/admin/users`.

Fields:

- Name, optional
- Email, required
- Role
- Status
- Tier

If the email already exists:

- Do not create a duplicate.
- Show the existing user.
- Allow admin to update status, role, and tier.

Manual users should be able to authenticate later through the normal login method using the same email.

If a manually added user logs in later, the auth flow should reuse the existing user record by email.

---

# 14. Bootstrap Admin

Keep the bootstrap behavior from the agent plan.

The system must support:

- The first user in the system becoming an active pro admin automatically, or
- Any user whose email appears in `INITIAL_ADMIN_EMAILS` becoming an active pro admin on first login

Recommended env var:

```env
INITIAL_ADMIN_EMAILS=jonathan@example.com,anotheradmin@example.com
```

When matched:

```ts
status = "active"
role = "admin"
tier = "pro"
```

This is important to prevent admin lockout.

---

# 15. Admin Console Requirements

Update `/admin/users` to include user management, approval, tiers, invite links, and usage counts.

## User List Columns

Include:

- Name
- Email
- Status
- Role
- Tier
- Demos created
- Enrichments today
- Total enrichments
- Created date
- Last login, if available
- Actions

## Filters

Add filters for:

- Pending Approval
- Active
- Suspended
- Free
- Pro
- Admin

## User Actions

Admins should be able to:

- Approve as Free
- Approve as Pro
- Reject
- Suspend
- Reactivate
- Change Tier
- Change Role
- Manually Add User
- Generate Invite Link
- Revoke Invite Link
- View usage

---

# 16. Invite Link Admin Panel

Add an Invite Links panel to the admin console.

Admins should be able to:

- Generate invite link
- Select tier: free or pro
- Add optional invited email
- Add optional note
- Set optional expiration date
- Copy invite URL
- See whether invite was used
- See who used it
- See when it was used
- Revoke unused invite links

---

# 17. Frontend Pending Approval UX

Create or update the pending approval screen.

Title:

```txt
Your account is awaiting approval
```

Body:

```txt
Thanks for signing up. Your account has been created, but access to demo creation is currently approval-based. You’ll be able to create demos once your account is approved.
```

Visible actions:

- Log Out

Optional secondary text:

```txt
If you believe you should already have access, contact support.
```

The header for pending users should show only:

- User email
- Log Out button

Pending users should not see the full app navigation.

---

# 18. Frontend Free Tier Limit UX

When an active free user already has one demo:

- Disable the New Demo button.
- Show a tooltip or small notice.

Tooltip:

```txt
Free tier: 1 demo limit. Contact us to upgrade.
```

If they attempt to bypass via API, backend should reject with:

```txt
FREE_DEMO_LIMIT_REACHED
```

---

# 19. Frontend Daily Enrichment Limit UX

On dashboard and demo detail pages, show current usage:

```txt
X/25 enrichments used today
```

When at the cap:

- Disable Enrich button
- Disable Regenerate button
- Disable other AI-cost buttons if applicable

Tooltip:

```txt
Daily limit reached (25/25). Resets at midnight UTC.
```

If using America/New_York reset, use:

```txt
Daily limit reached (25/25). Resets at midnight Eastern Time.
```

Backend should reject with:

```txt
DAILY_ENRICHMENT_LIMIT_REACHED
```

---

# 20. Landing Page / Signup Copy

Because this is not a fully open self-serve SaaS yet, update public-facing copy.

Replace:

```txt
Sign up free
```

With:

```txt
Request Access
```

Suggested supporting copy:

```txt
Live Site AI is currently available by request. New accounts are reviewed before activation.
```

For invite link users, the signup should still work cleanly and auto-activate them if the invite is valid.

---

# 21. API Error Codes

Use structured error responses for blocked actions.

Recommended shape:

```json
{
  "error": "ACCOUNT_PENDING_APPROVAL",
  "message": "Your account is pending approval."
}
```

Recommended error codes:

```txt
ACCOUNT_PENDING_APPROVAL
ACCOUNT_SUSPENDED
ADMIN_REQUIRED
FREE_DEMO_LIMIT_REACHED
DAILY_ENRICHMENT_LIMIT_REACHED
INVALID_INVITE
EXPIRED_INVITE
USED_INVITE
REVOKED_INVITE
INVITE_EMAIL_MISMATCH
```

The frontend should display friendly messages based on these codes.

---

# 22. Environment Variables

Add configurable limits:

```env
FREE_USER_TOTAL_DEMOS=1
PRO_USER_DAILY_ENRICHMENTS=25
SIGNUPS_REQUIRE_APPROVAL=true
INITIAL_ADMIN_EMAILS=
```

Optional:

```env
APP_BASE_URL=
SUPPORT_EMAIL=
USAGE_RESET_TIMEZONE=America/New_York
```

Use safe defaults if env vars are missing.

---

# 23. Audit Logging

Use the existing `admin_audit_log` table if available.

Audit-log these actions:

- User approved as free
- User approved as pro
- User rejected
- User suspended
- User reactivated
- User tier changed
- User role changed
- Invite link created
- Invite link consumed
- Invite link revoked
- Manual user created
- Manual user updated

Each audit record should include:

- Admin user ID
- Target user ID if applicable
- Action
- Timestamp
- Metadata

---

# 24. OpenAPI and Typed Client Updates

Update `openapi.yaml` with the new fields and endpoints.

Include:

- `pending_approval` status
- `free` and `pro` tier enum
- Usage payload
- Invite link payload
- Admin user management endpoints
- Error response shapes

Regenerate the typed client and Zod schemas if that is part of the existing project workflow.

---

# 25. Relevant Files From Agent Plan

The Replit agent identified these files as likely relevant:

```txt
lib/db/src/schema/auth.ts
lib/db/src/schema/index.ts
lib/api-spec/openapi.yaml
artifacts/api-server/src/middlewares/authMiddleware.ts
artifacts/api-server/src/lib/auth.ts
artifacts/api-server/src/routes/auth.ts
artifacts/api-server/src/routes/admin.ts
artifacts/api-server/src/routes/demos.ts
artifacts/api-server/src/services/audit.ts
artifacts/live-site-ai/src/App.tsx
artifacts/live-site-ai/src/components/protected-route.tsx
artifacts/live-site-ai/src/pages/admin-users.tsx
artifacts/live-site-ai/src/pages/dashboard.tsx
artifacts/live-site-ai/src/pages/demo-detail.tsx
artifacts/live-site-ai/src/pages/home.tsx
artifacts/live-site-ai/src/pages/signup.tsx
artifacts/live-site-ai/src/pages/login.tsx
```

Please verify the actual file names before editing.

---

# 26. Out of Scope

Do not build the following in this task:

- Stripe
- Paid subscription management
- In-app checkout
- Email notifications
- Multi-tenant agency seats
- Team accounts
- Advanced per-feature gating beyond demo creation and enrichment limits
- Full branded invite landing pages

Admin-managed access is enough for now.

---

# 27. Acceptance Criteria

This task is complete when:

1. A normal new signup lands in `pending_approval`.
2. A pending user cannot access dashboard, demos, settings, enrichment, or protected backend routes.
3. A pending user sees only a pending approval page and logout option.
4. Admin can approve a pending user as Free.
5. Admin can approve a pending user as Pro.
6. Admin can reject a pending user without deleting the user record.
7. Admin can suspend and reactivate users.
8. Admin can manually add a user by email.
9. Manual user creation does not duplicate existing emails.
10. Manually added users are recognized when they later authenticate.
11. Admin can generate one-time invite links.
12. Invite links can specify free or pro tier.
13. Valid invite links auto-activate the user at the selected tier.
14. Invalid, expired, revoked, already used, or mismatched-email invites do not grant access.
15. Active free users can create only 1 demo total.
16. Active pro users can create demos without a total demo cap for now.
17. Active pro users are limited to 25 enrichments per day.
18. Enrichment cap is enforced server-side.
19. Demo limit is enforced server-side.
20. Admin routes require active admin role server-side.
21. Usage counts are visible in the admin UI.
22. Frontend disables relevant buttons when limits are reached.
23. Backend still blocks direct API attempts even if frontend buttons are bypassed.
24. Landing page and signup language use `Request Access` instead of `Sign up free`.
25. Bootstrap admin behavior works through first user or `INITIAL_ADMIN_EMAILS`.
26. Admin actions are recorded in the audit log.
27. OpenAPI/client schema updates are completed if required by the app architecture.

---

# Final Instruction to Agent

Please proceed with Task #19 using your proposed plan, but incorporate all revisions in this document.

The most important requirements are:

1. Pending approval must be a hard backend block.
2. Free tier must be limited to 1 demo total.
3. Pro tier must be limited to 25 enrichments per day.
4. Invite links must auto-approve users at the selected tier.
5. Admin users must be able to approve, reject, suspend, reactivate, manually add users, generate invite links, and view usage.
6. The system must remain billing-ready, but billing itself is out of scope.
