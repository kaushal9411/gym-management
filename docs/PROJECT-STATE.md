# FitCloud — Project State

> **Read this file (and BACKEND-GUIDE.md / FRONTEND-GUIDE.md) before exploring code.**
> Updated after every prompt. Last updated: after **Prompt 11 (IAM)**.

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

## Known dev-only caveats (deliberate, documented in code)

- **RLS bypass in dev**: the app connects as a Postgres superuser, so raw-`prisma` (unscoped) queries bypass RLS. Production needs a non-superuser role. Every intentional cross-tenant raw query carries a comment saying so.
- **Pusher is an honest no-op stub** (no credentials configured); Socket.IO is the real realtime path.
- **Payment gateways are sandboxed stubs** — provider pattern is real, nothing charges.
- **Avatars are data-URLs** in `users.avatar_url` (no object storage yet; ≤192px JPEG, 200KB cap).
- `user_roles` / `role_permissions` / `permissions` are global link/catalog tables **without RLS** — isolation enforced at service layer (roles carry `tenantId`, queries join through users).

## Doc maintenance rule

After completing a prompt: update this file's prompt history + credentials, and the relevant sections of `BACKEND-GUIDE.md` / `FRONTEND-GUIDE.md`. Keep them accurate enough that the next session never needs to re-explore existing code.
