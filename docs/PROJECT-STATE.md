# FitCloud — Project State

> **Read this file (and BACKEND-GUIDE.md / FRONTEND-GUIDE.md) before exploring code.**
> Updated after every prompt. Last updated: after **Prompt 14 (Member Management)**.

FitCloud is an enterprise multi-tenant Gym Management SaaS. Turborepo monorepo, pnpm workspaces.

## Apps & ports

| App | Path | Port | What it is |
|---|---|---|---|
| API | `apps/api` | 4000 | Express + TypeScript + Prisma + PostgreSQL + Redis + BullMQ. Serves BOTH the tenant portal and the admin portal under `/api/v1`. Swagger at `/api/docs`. |
| Tenant portal | `apps/tenant-web` | 3001 | Next.js 15 App Router. Subdomain-per-tenant (`{slug}.localhost:3001` in dev). Gym owners/staff. |
| Super Admin portal | `apps/super-admin` | 3002 | Next.js 15. Platform team only — separate auth plane. |
| Landing / Mobile | `apps/landing-web`, `apps/mobile` | — | Untouched scaffolds. |

## Backing services (docker-compose at repo root)

| Container | Port | Notes |
|---|---|---|
| gym-saas-postgres | **5433**→5432 | DB `gym_saas`, user/pass `gym`/`gym`. `docker exec gym-saas-postgres psql -U gym -d gym_saas -c "..."` |
| gym-saas-redis | 6379 | Cache, rate limits, permission sets, onboarding sessions, BullMQ. |
| gym-saas-mailpit | 1025 SMTP / **8025** web+API | All dev email. OTP via `curl -s "http://localhost:8025/api/v1/messages?limit=1"` → 6 digits in Subject. |

## Dev commands

```bash
# from each app dir (pnpm may need `corepack pnpm` on this machine)
pnpm run dev            # api: tsx watch · web: next dev
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec eslint src --max-warnings=0
pnpm run build
pnpm exec vitest run    # api only; globs src/**/*.spec.ts
pnpm run prisma:seed    # api; idempotent upserts
pnpm exec prisma migrate dev --name <name> --skip-seed
```

Gotchas: killing dev servers can leave orphaned `node.exe` listeners — kill by port (`Get-NetTCPConnection -LocalPort 3001`). Running `next build` while `next dev` runs corrupts `.next` and kills the dev server. Env vars load once at API startup (restart after `.env` edits). After changing seed permissions, re-run seed AND consider Redis `FLUSHALL` for stale permission caches.

## Test credentials (dev DB)

| Who | Where | Credentials |
|---|---|---|
| Super admin | `localhost:3002/login` | `admin@fitcloud.com` / `SuperAdmin@2026` |
| Tenant owner | `prompt10test.localhost:3001/login` | `dana.lee@prompt10test.com` / `TestPass!2026` |
| Staff (custom role "Front Desk Lead") | same tenant | `sam.staff@prompt10test.com` / `StaffPass!2026` |
| Staff (via invitation) | same tenant | `invited.trainer@prompt10test.com` / `Trainer!2026A` |

Prompt 12 exercised the above `dana.lee` (OWNER, has `settings:manage`) against `/gym-settings/*`; no new credentials were added.
Prompt 13 exercised `dana.lee` (OWNER, has all `staff:*` perms) against `/staff/*`; test staff accounts created during verification were soft-deleted afterward — no new persistent credentials were added.
Prompt 14 exercised `dana.lee` against `/members/*` and `/membership-plans/*`; test member accounts created during verification were soft-deleted afterward. Two real membership plans ("3-Month Cardio", "Annual Gold") were left in place intentionally as usable catalog data, not cleaned up.
Prompt 15 exercised `dana.lee` against the expanded `/membership-plans/*` (full CRUD/activate/duplicate) and the new `/members/:id/membership/{downgrade,extend,cancel}` + `/members/:id/resume` endpoints; test member/plan records created during verification were soft-deleted afterward, except one E2E test plan's duplicate which was left active as usable catalog data.

API smoke pattern: login with header `X-Tenant-Slug: prompt10test` (or use the subdomain Host), grab `data.accessToken`, send `Authorization: Bearer`.

## Prompt history (what exists)

1–4 — Scaffolding, docker, core API skeleton, coding standards (`docs/coding-guidelines/`).
5–6 — **Authentication** (tenant plane): register/login/OTP/2FA/refresh-rotation/lockout/password reset/email verify/sessions/logout-all; JWT RS256, audience `fitcloud-tenant-app`; RLS on all tenant tables.
7 — **Onboarding wizard**: 7-step registration (`/register`), Redis session, sandbox payment, automatic tenant provisioning, cross-origin token handoff via URL fragment → `/onboarding-complete`.
8 — **Billing platform**: plans, subscription lifecycle (Trial→Active→PastDue→Grace→Suspended→Cancelled/Expired), gateway provider pattern (sandboxed Stripe/Razorpay/PayPal), coupons, invoices, webhooks, BullMQ sweeps, billing UI under `/billing`.
9 — **Super Admin portal**: separate JWT plane (`fitcloud-admin-app`, `core/security/admin-jwt.service.ts`), ~16 `admin-*` API modules, full Next app. Admin & tenant JWTs cryptographically cross-reject.
10 — **Tenant portal shell**: sidebar/header/dashboard widgets, tenant resolve enriched (branding/subscription/featureFlags/defaultBranch), tenant notifications + Socket.IO, Redux slices, shared UI kit.
11 — **IAM** (see BACKEND-GUIDE.md §IAM): users/roles/permissions/invitations/sessions/profile/audit modules, permission engine with per-user GRANT/DENY overrides, branch access, invitation flow, full frontend under `/users` `/roles` `/permissions` `/invitations`, profile & sessions UI.
11.5 — **Expiry rescue path**: expired trial/subscription no longer dead-ends — login + billing endpoints stay open (`EXPIRY_EXEMPT_PREFIXES` in tenant.middleware), status screens link to real `/billing` checkout, renewal payment reactivates the tenant. Verified live end-to-end.
12 — **Gym Profile, Branding & Business Settings** (see BACKEND-GUIDE.md §Settings, FRONTEND-GUIDE.md `gym-settings`): new `settings` module — gym profile (legal/contact/address/geo/business-hours/social-links), business settings (currency/timezone/date-time-format/measurement-unit), branding (colors/theme/logo/favicon/login-bg/dashboard-banner/email-logo, all data-URL uploads), invoice settings (prefix/tax/payment-terms/footer), email settings, notification prefs (SMS config-only). New tables `TenantProfile`, `TenantInvoiceSettings`; extended `TenantSettings`/`TenantBranding`. Perms `settings:read` (new) / `settings:manage` (existing). Every write invalidates the tenant resolve cache. Sidebar entry "Gym Settings" → `/gym-settings/profile`. Verified live via curl (permissions, audit trail, cache invalidation, 8-endpoint regression) and full Playwright E2E (all 4 pages, cancel-discards-edits, post-branding dashboard reload, IAM regression) — zero console errors.
13 — **Staff Management** (see BACKEND-GUIDE.md §Staff Management, FRONTEND-GUIDE.md `staff`): new `staff` module scoped to the three staff types (Manager/Trainer/Receptionist — Owner already exists, Member is out of scope). New table `StaffProfile` (1:1 `User`, RLS'd) carries employeeId (auto-generate + editable), firstName/lastName, gender, DOB, joining date, address, notes, and employment info (type/salary/shift/weekly-off/work-status); `User` itself is reused for auth/status/contact/emergency-contact/avatar, `UserBranch`/`UserRole` reused for branch+role assignment. New perms `staff:view/create/update/delete/restore/activate/invite/assign-branch/assign-role`, all granted to MANAGER. Subscription staff-limit enforcement (`TenantLimit.maxManagers/maxTrainers/maxReceptionists/maxStaff`) added from scratch — no prior enforcement existed anywhere. Create Staff sends an activation email (reuses the invitation email template + PasswordReset token machinery, NOT the `UserInvitation` table, since the User row already exists at creation time) — staff sets their own password at `/staff-activation/{token}`, flipping PENDING_VERIFICATION→ACTIVE. Reset Password reuses `forgotPassword`'s internals. CSV export/import + bulk activate/deactivate/delete included. Sidebar entry "Staff" → `/staff` (distinct from the pre-existing "Staff & Access" IAM entry → `/users`). **Fixed a pre-existing bug found while testing this module**: the API's CORS `methods` whitelist (`app.ts`) was missing `PUT`, silently blocking every PUT-based browser action including the already-shipped IAM roles/branches assignment — added `PUT` to the list. Verified live via curl (full CRUD, invitation flow, subscription-limit rejection at the exact plan cap, bulk ops, audit trail, 9-endpoint regression) and full Playwright E2E (create→email→activate→login→edit→assign-role→suspend→restore→bulk-deactivate→dashboard/IAM regression) — zero console errors.
13.5 — **Sidebar "coming soon" placeholders**: the 10 nav items already gated by plan feature flags but with no page built yet (Members, Branches, Memberships, Attendance, Workout Plans, Diet Plans, Payments, Income, Expenses, Reports) 404'd on click — a pre-existing, project-wide gap (not new). Added a shared `components/coming-soon.tsx` + one placeholder `page.tsx` per route so every nav item resolves to something real. Superseded for `/members` and `/memberships` by Prompt 14 below.
13.6 — **Tenant provisioning data repair (ad hoc)**: a real tenant (`kaushalgym`) was found stuck half-provisioned — `tenant_settings`/`tenant_branding` existed but `branches`/`tenant_modules`/`tenant_limits`/`tenant_usage`/`subscriptions` did not (the onboarding saga in `tenant-provisioning.service.ts` creates these in sequence; something interrupted it after branding). Backfilled all missing rows on the Enterprise plan directly via SQL, then flushed the `tenant:slug:*`/`tenant:id:*` Redis cache keys so the fix was visible without a restart. One-off data fix, not a code change — if this recurs, the provisioning saga likely needs to run inside a single DB transaction instead of sequential awaits.
14 — **Member Management** (see BACKEND-GUIDE.md §Member Management, FRONTEND-GUIDE.md `members`): new `members` module — `Member` is a standalone record, NOT a `User` row (no invitation/login flow was requested for this prompt, unlike Staff). New tables `Member` (memberId auto-gen+editable, profile/medical/emergency-contact fields, QR token+image, soft-delete), `MembershipPlan` (the gym's own plan catalog — distinct from FitCloud's `SubscriptionPlan`), `Membership` (one row per period; renew/upgrade supersede the old row instead of mutating it, so Renewal History is just this member's rows), `MembershipFreeze` (Freeze History), `MemberDocument` (inline data-URL uploads, images downscaled client-side via the existing `fileToDataUrl`, non-images via new `fileToRawDataUrl`, both in `lib/image-to-data-url.ts`). Business rule "one active membership per member" enforced in `MemberService`. Trainer assignment reuses the Staff module's `User`+`TRAINER`-role query; branch assignment reuses `Branch`. QR codes generated server-side with the `qrcode` npm package (newly added — nothing existed for this before). New perms `members:view/create/update/delete/restore/import/export/assign-trainer/assign-membership`, granted to MANAGER (all) and RECEPTIONIST (view/create/update/import/export/assign-membership); reuses the pre-existing `memberships:manage` permission for the plan-catalog CRUD. Subscription member-limit enforcement (`TenantLimit.maxMembers`) added, same pattern as Prompt 13's staff limits. Sidebar "Members" (existing nav item, permission bumped from the old speculative `members:read` to the new `members:view`) and "Memberships" (was a coming-soon stub, now a real minimal plan-catalog page — needed so "Assign Membership Plan" has something to assign). Verified live via curl (full CRUD, membership assign/renew/upgrade/freeze/unfreeze lifecycle, member-limit rejection at the exact plan cap, bulk ops, CSV export/import, audit trail, 10-endpoint regression) and full Playwright E2E (plan create→member create→assign→freeze→unfreeze→renew→edit→QR→document upload→bulk-deactivate→dashboard/staff regression) — zero console errors.

13.5 — **Password-hashing perf fix**: `/auth/login` (and every other password hash/verify path — register, staff activation, password reset) was measured live at ~900-950ms while every other endpoint ran 25-110ms. Root cause: `bcryptjs` (pure-JS bcrypt) doing a single `compare()` at cost factor 12 takes ~550-900ms on its own on dev hardware — confirmed by direct benchmark, not a DB/query issue. Fix: swapped the sole choke point `core/security/password.service.ts` (plus the two other direct-bcrypt call sites, `admin-roles/services/admin-role.service.ts` and `prisma/seed.ts`) from `bcryptjs` to `@node-rs/bcrypt` (napi-rs, prebuilt binaries for win32/darwin/linux — no node-gyp/build-tools step, same `$2` hash format so existing hashes keep verifying), **and** lowered `BCRYPT_SALT_ROUNDS` default from 12 → 10 (`.env`/`.env.example`/`config/env.ts` zod default; min allowed is still 10). Net: new hashes verify in ~260-280ms instead of ~950ms. Note the cost factor is baked into each stored hash at creation time — existing users keep their old (slower) hash until their password changes; the 4 documented dev test-credential accounts (`dana.lee`, `sam.staff`, `invited.trainer`, `admin@fitcloud.com`) were rehashed at cost 10 with their same known passwords so the fix is visible immediately, credentials unchanged. `bcryptjs`/`@types/bcryptjs` removed entirely (no remaining references). Verified: typecheck/eslint(0 warnings)/build/vitest(51 passed) all green, plus live curl timing before/after on the running dev stack.

15 — **Membership Plans module** (see BACKEND-GUIDE.md §Membership Plans, FRONTEND-GUIDE.md `members` feature additions): expands the `MembershipPlan` model from a Prompt 14 scaffold (name/duration/price/isActive) into a full plan catalog — added `planCode` (auto-gen + editable, unique per tenant), `category`, `durationValue`+`durationType` (DAYS/WEEKS/MONTHS/YEARS, calendar-aware via a new `addDuration()` helper — `durationDays` kept only as an approximate display cache), `joiningFee`/`taxPercentage`/`discountPercentage`, `displayOrder`, `notes`, soft-delete (`deletedAt` — didn't exist on this model before), Plan Features (gym/branch access, PT sessions, group classes, diet consultation, locker access, guest passes, freeze allowed + days limit), and Membership Rules (validity window, grace period, renewal window, auto-renewal, min/max age). New backend actions: Activate/Deactivate/Soft-Delete/Restore/Duplicate Plan, and on the member side Downgrade/Extend/Cancel Membership + a `/resume` alias for the existing `/unfreeze` (same underlying action, new name to match this module's vocabulary). New granular perms `memberships:view/create/update/delete/restore/assign/renew/upgrade/freeze` replace the old blanket `members:assign-membership` on all membership-lifecycle routes (kept seeded but now unused, same "leave the old key as a harmless legacy" pattern as Prompts 13/14) — MANAGER gets all 9, RECEPTIONIST gets view/assign/renew/upgrade/freeze only (plan-catalog CRUD stays a Manager decision, a deliberate tightening vs the old blanket `memberships:manage`), TRAINER gets view only. Business rules verified live: plan code + name uniqueness, inactive/deleted plans rejected on assign, minimum-age gate, and the renewal-window rule (a renew attempt correctly rejected outside its configured window). Frontend: full Membership Plan List/Create/Edit pages (search/pagination/sort/filters/status-toggle/duplicate/confirm-dialogs) under `/memberships`, plus Downgrade/Extend/Cancel actions and a Freeze→"Resume" rename added to the existing Member detail page's Membership card. Verified live via curl (full plan CRUD + all business rules + 11-endpoint regression) and full Playwright E2E (plan create→edit→deactivate/activate→duplicate→member create→assign→extend→upgrade→downgrade→freeze→resume→cancel→plan soft-delete→dashboard/members/staff regression) — zero console errors.

## Known dev-only caveats (deliberate, documented in code)

- **RLS bypass in dev**: the app connects as a Postgres superuser, so raw-`prisma` (unscoped) queries bypass RLS. Production needs a non-superuser role. Every intentional cross-tenant raw query carries a comment saying so.
- **Pusher is an honest no-op stub** (no credentials configured); Socket.IO is the real realtime path.
- **Payment gateways are sandboxed stubs** — provider pattern is real, nothing charges.
- **Avatars are data-URLs** in `users.avatar_url` (no object storage yet; ≤192px JPEG, 200KB cap).
- `user_roles` / `role_permissions` / `permissions` are global link/catalog tables **without RLS** — isolation enforced at service layer (roles carry `tenantId`, queries join through users).

## Doc maintenance rule

After completing a prompt: update this file's prompt history + credentials, and the relevant sections of `BACKEND-GUIDE.md` / `FRONTEND-GUIDE.md`. Keep them accurate enough that the next session never needs to re-explore existing code.
