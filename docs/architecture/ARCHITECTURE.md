# FitCloud — Multi-Tenant Gym Management SaaS Platform

**Version:** 2.0 · **Date:** 2026-07-04 · **Status:** Approved for implementation
**Supersedes:** v1.0 · **Author:** Principal Solution Architecture

> One application, unlimited gyms. Each tenant gets an isolated portal at
> `https://{gym}.fitcloud.com`, fully branded, with data isolation guaranteed
> at three independent layers.

---

## Table of Contents

| § | Section | § | Section |
|---|---|---|---|
| 1 | High-Level Architecture | 14 | Coding Standards |
| 2 | Monorepo Structure | 15 | Naming Convention |
| 3 | Folder Structure | 16 | Git Branch Strategy |
| 4 | Module Structure | 17 | Error Handling Strategy |
| 5 | Database Design Strategy | 18 | Logging Strategy |
| 6 | Multi-Tenant Strategy | 19 | Notification Strategy |
| 7 | Authentication Flow | 20 | Real-Time Communication Strategy |
| 8 | Authorization Flow | 21 | Caching Strategy |
| 9 | Subdomain Routing Flow | 22 | Background Job Strategy |
| 10 | Subscription Flow | 23 | Mobile Architecture |
| 11 | Deployment Architecture | 24 | Scalability Strategy |
| 12 | CI/CD Strategy | 25 | Future Expansion Strategy |
| 13 | Security Strategy | A/B | Appendices |

---

## 1. High-Level Architecture

### 1.1 Architectural Style

- **Modular monolith** backend (Express) built on **Clean Architecture** — 20+ feature modules with microservice-grade boundaries, deployed as one unit. Maximizes v1 delivery speed and transactional integrity; module seams are the future extraction lines (§25).
- **Two planes, one codebase:**
  - **Platform plane** — landing site, gym registration, subscription billing, tenant provisioning, Super Admin. Operates *on* tenants.
  - **Tenant plane** — the gym portal + mobile app. Operates *inside* one tenant, resolved from the subdomain.
- **Multi-tenancy:** shared PostgreSQL database, shared schema, `tenant_id` on every tenant table, enforced at three layers (§6).
- **Event-driven side effects:** every mutation that triggers notifications, audit, counters, or webhooks writes a **transactional outbox** row; BullMQ workers do the rest. Request handlers stay thin and fast.

### 1.2 System Context

```
                 ┌────────────────────────────────────────────────────┐
                 │                     Cloudflare                     │
                 │  Wildcard DNS *.fitcloud.com · CDN · WAF · DDoS    │
                 └───────────────────────┬────────────────────────────┘
                                         │ HTTPS / WSS
                 ┌───────────────────────▼────────────────────────────┐
                 │                Nginx (reverse proxy)               │
                 │  routes by Host header + path, TLS, gzip, ws pass  │
                 └───┬───────────────┬───────────────┬────────────────┘
      fitcloud.com   │  {tenant}.…   │  api.…        │  api.… /socket.io
      admin.…        │               │               │
    ┌────────────────▼┐   ┌──────────▼─────┐  ┌──────▼──────────┐
    │  Next.js 15 web │   │  Express API   │  │ Socket.IO nodes │
    │ landing + admin │   │  /api/v1 (N×)  │  │ (Redis adapter) │
    │ + tenant portal │   └──┬───┬───┬─────┘  └──────┬──────────┘
    └─────────────────┘      │   │   │               │
                   ┌─────────▼┐ ┌▼───▼─────┐ ┌───────▼───────┐
                   │PostgreSQL│ │  Redis   │ │    Pusher     │
                   │Prisma+RLS│ │cache/    │ │ notifications │
                   └──────────┘ │queue/pub │ │ channels      │
                                └────┬─────┘ └───────────────┘
                        ┌────────────▼────────────┐
                        │ BullMQ workers+scheduler│──► Nodemailer(SES) / SMS
                        └─────────────────────────┘    FCM push / Webhooks
    Flutter app ──► api.fitcloud.com (Dio, tenant header) + Socket.IO + FCM/Pusher
```

### 1.3 Core Principles

1. **The subdomain is the tenant.** No tenant pickers, ever — web resolves tenant from `Host`, mobile from a one-time slug/QR onboarding (§9, §23).
2. **Isolation is layered, never single-point** — request context + tenant-scoped ORM + PostgreSQL RLS (§6).
3. **Limits are data, not code** — plan limits/features live in `saas_plans.limits` jsonb and are enforced by one guard service (§10.4), so new plans need zero deploys.
4. **Everything eventual goes through the outbox** — no email/push/audit inline in a request.
5. **Stateless services everywhere** — sessions in PG/Redis, sockets via Redis adapter → any node can die or scale at any time.

---

## 2. Monorepo Structure

Turborepo + pnpm workspaces. One PR can change API contract + web + shared types atomically; affected-only builds keep CI fast.

```
fitcloud/
├── apps/
│   ├── api/                  # Express.js — platform + tenant REST API
│   ├── web/                  # Next.js 15 — landing + admin + tenant portals (one app,
│   │                         #   three route groups; subdomain-driven, §3.2/§9)
│   ├── realtime/             # Socket.IO gateway (thin, no business logic)
│   ├── worker/               # BullMQ consumers + scheduler (same domain code as api
│   │                         #   via shared modules; separate process/scaling)
│   └── mobile/               # Flutter app (tooling-only workspace member)
├── packages/
│   ├── shared-types/         # DTOs, enums, API contracts, socket event types
│   ├── validation/           # Zod schemas — single source of truth web+api
│   ├── ui/                   # ShadCN-based shared component library
│   └── config/               # tsconfig / eslint / prettier presets
├── infra/
│   ├── docker/               # Dockerfiles, compose.dev.yml, compose.prod.yml
│   ├── nginx/                # nginx.conf templates (dev + prod)
│   └── terraform/            # AWS infra as code (VPC, RDS, ElastiCache, ECS/EC2, S3)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── adr/                  # ADR-0001 …
│   └── api/                  # exported OpenAPI specs per version
├── .github/workflows/        # CI/CD (§12)
├── turbo.json · pnpm-workspace.yaml · package.json
```

---

## 3. Folder Structure

### 3.1 Backend — `apps/api` (Clean Architecture, feature-based modules)

Dependency rule: `presentation → application → domain`; `infrastructure` implements interfaces that `domain`/`application` define. `domain` imports nothing from Express/Prisma/Redis.

```
apps/api/src/
├── modules/
│   ├── platform/                        # ── PLATFORM PLANE ──
│   │   ├── registration/                # public gym signup + slug availability
│   │   ├── subscriptions/               # SaaS plans, trial, renew/upgrade/downgrade
│   │   ├── payments-gateway/            # Stripe/Razorpay adapters, webhooks
│   │   ├── tenant-management/           # provisioning, suspension, limits, flags
│   │   └── super-admin/                 # cross-tenant ops, impersonation, analytics
│   └── tenant/                          # ── TENANT PLANE ──
│       ├── auth/          users/        rbac/
│       ├── branches/      staff/        members/
│       ├── memberships/   attendance/   classes/
│       ├── workout-plans/ diet-plans/   trainers/
│       ├── payments/      invoices/     reports/
│       ├── notifications/ chat/         settings/   # branding, tz, currency, tax,
│       └── audit/                                   #   email/SMS templates
│
│   # Every module has the same internal anatomy:
│   #   <module>/
│   #   ├── presentation/   *.controller.ts  *.routes.ts  *.swagger.ts
│   #   ├── application/    *.service.ts  dtos/  mappers/  policies/
│   #   ├── domain/         *.entity.ts  *.repository.ts (interface)  events/
│   #   └── infrastructure/ *.prisma-repository.ts
│
├── core/                                # cross-cutting kernel
│   ├── middleware/       # auth, tenant-context, rbac, plan-limit-guard,
│   │                     # rate-limit, request-id, validation, error-handler
│   ├── errors/           # AppError hierarchy + error-codes catalog
│   ├── events/           # in-process event bus + outbox dispatcher
│   ├── jobs/             # queue names, job contracts (impl in apps/worker)
│   ├── logging/          # Winston setup, correlation context (§18)
│   ├── security/         # jwt service, argon2 hashing, encryption helpers
│   └── container.ts      # DI registration (awilix) — constructor injection only
├── infrastructure/                      # shared adapters (behind interfaces)
│   ├── database/         # prisma client, tenantScopedClient, tx helper
│   ├── cache/            # Redis cache abstraction
│   ├── mail/             # Nodemailer transport (SES SMTP)
│   ├── sms/  push/       # SMS provider, FCM admin
│   ├── storage/          # S3 presigned upload/download
│   └── payments/         # gateway clients
├── api/
│   ├── v1/router.ts      # mounts platform + tenant routes under /api/v1
│   └── v2/router.ts      # future — versions coexist during deprecation window
├── config/               # zod-validated env, constants, plan-limits defaults
├── app.ts                # express assembly: helmet → cors → parsers → routes → errors
└── server.ts             # bootstrap, graceful shutdown
prisma/  schema.prisma · migrations/ · seed/
tests/   unit/ · integration/ · e2e/
```

### 3.2 Web — `apps/web` (Next.js 15 App Router — one app, three faces)

```
apps/web/src/
├── app/
│   ├── (landing)/            # fitcloud.com — marketing, pricing, register, docs
│   ├── (admin)/              # admin.fitcloud.com — super admin portal
│   ├── (portal)/             # {tenant}.fitcloud.com — the gym portal
│   │   ├── layout.tsx        # tenant-branded shell (logo/theme from tenant config)
│   │   ├── login/  dashboard/  members/  staff/  branches/  attendance/
│   │   ├── memberships/  workout-plans/  diet-plans/  payments/
│   │   ├── reports/  chat/  settings/
│   └── tenant-not-found/     # unknown subdomain page
├── middleware.ts             # subdomain → face routing + auth guard (§9)
├── features/<feature>/       # api/ (TanStack Query hooks) · components/ · hooks/ · store/
├── components/  ui/ (ShadCN) · layout/ · data-table/ · charts/
├── lib/                      # axios instance (interceptors), socket client, utils
├── store/                    # Redux Toolkit (UI/session state ONLY)
├── providers/                # Query, Redux, Theme(tenant branding), Socket
└── config/ · types/ · styles/
```

**State rule:** TanStack Query owns all server state; Redux owns only client state (session, active branch, sidebar, filters, toasts, socket status). Never mirror server data into Redux.

### 3.3 Mobile — `apps/mobile` (Flutter) — detailed in §23

```
lib/
├── core/          # dio + interceptors, secure storage, DI (get_it), theme, errors
├── features/<feature>/{data,domain,presentation}/     # BLoC per feature
├── shared/        # widgets, extensions, constants
└── main_{dev,staging,prod}.dart                        # flavors
android/           # Kotlin platform channels (biometrics, QR/NFC, Health Connect)
```

---

## 4. Module Structure

### 4.1 Platform-Plane Modules

| Module | Responsibility |
|---|---|
| `registration` | Public signup: gym info, slug pick + availability check, owner account, trial start |
| `subscriptions` | Plan catalog (Starter/Professional/Enterprise), trial, expiry, renewal, upgrade/downgrade, grace/suspension state machine |
| `payments-gateway` | Checkout sessions, gateway webhooks (signature-verified), invoices for the SaaS itself, dunning |
| `tenant-management` | Provisioning saga, subdomain lifecycle, plan-limit counters, feature flags, suspension/reactivation, data export/erasure |
| `super-admin` | Tenant CRUD/search, platform KPIs, announcements, audited impersonation, support tools |

### 4.2 Tenant-Plane Modules

| Module | Responsibility |
|---|---|
| `auth` | Login, refresh rotation, MFA, password reset, invitations, sessions/devices |
| `users` / `rbac` | Staff accounts; roles, permissions, per-branch role assignment |
| `branches` | Locations, working hours, capacity, timezone per branch |
| `staff` | Manager/trainer/receptionist profiles, schedules, staff attendance |
| `members` | Profiles, KYC/documents, health data, photos, freeze/transfer, member codes |
| `memberships` | Tenant's own plan catalog, enrollment, renewals, freezes, expiry automation |
| `attendance` | Check-in/out (QR/manual/biometric), live occupancy, history |
| `classes` | Schedules, capacity, bookings, waitlists (Professional+ feature) |
| `trainers` | Availability, PT packages, member assignment, commissions |
| `workout-plans` / `diet-plans` | Plan builders, exercise/meal libraries, member assignment, progress |
| `payments` / `invoices` | Member billing: invoices, gateway + cash/POS payments, dues, refunds, tenant tax settings, receipts |
| `reports` | Revenue, churn, attendance heatmaps, trainer utilization, exports (CSV/PDF) |
| `notifications` | In-app inbox, template rendering with tenant overrides, preferences |
| `chat` | Member ↔ trainer / staff threads (Socket.IO), moderation, retention policy |
| `settings` | Branding (logo/theme), timezone, currency, tax, email/SMS templates |
| `audit` | Append-only trail of sensitive mutations + authz denials |

### 4.3 Interaction Rules

1. Modules call each other only via **application service interfaces** resolved through DI — never another module's repository, controller, or Prisma models.
2. Cross-module side effects (notify, audit, counters, projections) go through **domain events → outbox → BullMQ**. Never inline.
3. Platform plane may reach into tenant plane only through `tenant-management`'s provisioning/limits interfaces; tenant plane never imports platform modules (it reads plan context from request context).
4. Every module owns its tables; cross-module reads of another module's tables are forbidden — ask the owning service.

---

## 5. Database Design Strategy

### 5.1 Conventions

- PK `id UUID v7` (time-ordered, index-friendly, safe to expose).
- Every tenant-plane table: `tenant_id UUID NOT NULL` + composite indexes `(tenant_id, <hot column>)`.
- `created_at` / `updated_at` everywhere; soft delete (`deleted_at`) on business entities.
- Money: `NUMERIC(12,2)` + `currency CHAR(3)` (tenant default currency in settings). Never floats.
- Statuses as PostgreSQL enums via Prisma; jsonb for genuinely flexible payloads (branding, plan limits, workout structure) — never for queryable relational data.

### 5.2 Entity Map (condensed)

```
PLATFORM (no tenant_id — these tables ARE about tenants)
  tenants(id, name, slug UNIQUE, status: trial|active|past_due|suspended|cancelled,
          region, created_at)
  tenant_settings(tenant_id, branding jsonb{logo,colors,theme}, timezone, currency,
          tax jsonb, locale)
  saas_plans(id, name, price_monthly, price_yearly, limits jsonb{max_branches,
          max_trainers, max_managers, max_members, max_storage_mb},
          features jsonb{chat, classes, api_access, custom_roles, white_label}, trial_days)
  saas_subscriptions(id, tenant_id, plan_id, status, current_period_start/end,
          trial_ends_at, cancel_at_period_end, gateway_customer_ref, gateway_sub_ref)
  saas_invoices / saas_payments               # billing the tenants
  tenant_usage_counters(tenant_id, metric, value, updated_at)   # limits enforcement
  feature_flags / tenant_feature_overrides
  platform_admins(id, email, password_hash, mfa_secret)          # separate realm

IDENTITY (tenant plane)
  users(id, tenant_id, email, phone, password_hash, status, mfa_secret, last_login_at)
        UNIQUE(tenant_id, email)              # same email can exist in two gyms
  roles(id, tenant_id NULL→system, name, is_system)
  permissions(id, key)  ·  role_permissions(role_id, permission_id)
  user_branch_roles(user_id, branch_id, role_id)
  sessions(id, user_id, tenant_id, refresh_token_hash, device_info, ip,
           expires_at, revoked_at, replaced_by)

GYM OPERATIONS (all tenant_id-scoped)
  branches · staff_profiles · members · membership_plans · memberships ·
  membership_freezes · invoices · payments · refunds · attendance_records ·
  class_types · class_schedules · class_bookings · pt_sessions ·
  exercises · workout_plans · diet_plans · body_assessments ·
  chat_threads · chat_messages · documents(s3 refs)

CROSS-CUTTING
  notifications(id, tenant_id, recipient_id, channel, template_key, payload jsonb,
                status, read_at)
  notification_templates(id, tenant_id NULL→system default, key, channel, locale,
                subject, body)                 # tenant email/SMS template overrides
  audit_logs(id, tenant_id, actor_id, actor_role, action, entity_type, entity_id,
             before jsonb, after jsonb, ip, ua, at)     # append-only, monthly partitions
  outbox_events(id, tenant_id, aggregate, event_type, payload, occurred_at, processed_at)
  idempotency_keys(key, tenant_id, request_hash, response, expires_at)
  webhook_endpoints / webhook_deliveries
```

### 5.3 Data-Layer Policies

- **Migrations:** Prisma Migrate; **expand → migrate → contract** for zero downtime; executed as a dedicated deploy job — never at container boot.
- **Partitioning:** `audit_logs`, `attendance_records`, `chat_messages` — monthly range partitions (highest volume).
- **Reporting reads** hit materialized views (`mv_daily_revenue`, `mv_member_churn`, `mv_class_utilization`) refreshed by scheduled jobs — analytics never scans OLTP at request time.
- **Backups:** automated snapshots + WAL PITR (RPO ≤ 5 min); quarterly restore drills.
- **Retention:** audit ≥ 7 years; cancelled-tenant data retained 90 days (export offered), then purged; member right-to-erasure workflow.

---

## 6. Multi-Tenant Strategy

### 6.1 Model Decision

| Option | Verdict |
|---|---|
| DB-per-tenant | ❌ v1 — migration fan-out × thousands of tenants, cost at long tail |
| Schema-per-tenant | ❌ — weak Prisma support, pool fragmentation, migration fan-out |
| **Shared schema + `tenant_id` + RLS** | ✅ — one migration, thousands of tenants, DB-enforced isolation |

Enterprise upsell path preserved: repository pattern makes "dedicated DB for this tenant" a routing change, not a rewrite (§25).

### 6.2 Three Enforcement Layers (defense in depth)

```
Layer 1 — Request context
  tenant middleware resolves tenant (subdomain → cache → DB), validates it against
  the JWT's tenant_id claim, stores {tenantId, userId, role, branchIds} in
  AsyncLocalStorage. Mismatch or suspended tenant → reject before any handler runs.

Layer 2 — Tenant-scoped Prisma client
  a Prisma client extension auto-injects tenant_id into every where/create/update
  for tenant-plane models. Repositories receive ONLY this scoped client — they
  cannot forget the filter because they never see the raw client.

Layer 3 — PostgreSQL Row-Level Security
  every tenant table has a policy: tenant_id = current_setting('app.tenant_id')::uuid,
  set per transaction. Even a bug in layers 1–2 cannot return foreign rows.
```

**Additional isolation surfaces:** Redis keys prefixed `t:{tenantId}:…`; S3 object keys `tenants/{tenantId}/…` with per-request presigned URLs; socket rooms namespaced by tenant (§20); BullMQ job payloads carry `tenantId` and workers re-establish context before touching the DB; per-tenant rate limits and job concurrency caps (noisy-neighbor fairness).

### 6.3 Per-Tenant Configuration

`tenant_settings` drives: branding (logo, colors, theme tokens applied to the portal shell), timezone (all scheduling stored UTC, rendered in tenant/branch tz), currency & tax rules (applied by invoices module), email/SMS template overrides (fallback to system defaults), locale. Cached in Redis (`t:{id}:settings`, TTL 5 min + event invalidation) because every request and every rendered notification reads it.

---

## 7. Authentication Flow

### 7.1 Token Model

| Token | Lifetime | Web storage | Mobile storage | Notes |
|---|---|---|---|---|
| Access JWT (RS256) | 15 min | Memory only | flutter_secure_storage (Keychain / EncryptedSharedPreferences) | Claims: `sub, tenant_id, role, branch_ids, perm_ver, sid, jti` |
| Refresh token (opaque 256-bit, **rotating**) | 30 days | `httpOnly Secure SameSite=Lax` cookie, domain-scoped to the tenant subdomain | secure storage | Only hash stored (`sessions`); reuse ⇒ revoke session family |

RS256 so realtime gateway + workers verify with the public key only; private key in AWS KMS/Secrets Manager. Three auth realms share the mechanism, never tokens: **platform admin** (`admin.`), **tenant staff/owner**, **member** — a tenant token is useless on the admin API and vice versa (`aud` claim + separate route guards).

### 7.2 Login (tenant portal)

```
Browser at goldgym.fitcloud.com                API
  │ POST /api/v1/auth/login {email, password}   │  (tenant already known from Host —
  ├─────────────────────────────────────────────► subdomain middleware resolved it;
  │                                              │  user NEVER selects a tenant)
  │   1. rate-limit (IP + email + tenant)        │
  │   2. load user WHERE tenant_id + email       │
  │   3. argon2id verify (constant-time; dummy hash when user absent)
  │   4. tenant status check (suspended → 403 TENANT_SUSPENDED)
  │   5. MFA? → return mfa_required + short-lived mfa_token → /auth/mfa/verify
  │   6. create session row · mint access JWT · set refresh cookie
  │   7. outbox: user.logged_in → audit + anomaly detection
  ◄── { accessToken, user, role, permissions, branding }
```

- **Refresh:** `POST /auth/refresh` — hash lookup, revocation check, **rotate** (issue new, mark old `replaced_by`). A *replaced* token presented again ⇒ theft assumed ⇒ revoke entire family + security alert to user.
- **Logout:** revoke session; denylist access `jti` in Redis for remaining TTL.
- **Invitations:** staff and members are created by the gym; they receive a single-use set-password link (24 h TTL). Password reset: single-use hashed token, 30 min, all sessions revoked on success.
- **Mobile:** identical endpoints; tenant context from stored slug header (§23); refresh handled by a Dio interceptor with single-flight locking.
- **Impersonation (Super Admin):** short-lived token with `act` claim carrying the admin's identity; both identities audited on every request; portal shows a persistent banner.

## 8. Authorization Flow

**Model: RBAC + granular permissions + row scopes.**

- Permission = `resource:action` (`members:create`, `payments:refund`, `reports:view-financial`) — global seeded catalog.
- System roles (immutable): Super Admin (platform realm) · Owner · Manager · Trainer · Receptionist · Member. Custom roles = Enterprise feature flag.
- Roles are assigned **per branch** (`user_branch_roles`) — one person can be Manager at branch A and Trainer at branch B.
- Row scopes evaluated in the service layer: Owner → whole tenant; Manager/Receptionist → assigned branches; Trainer → assigned branches ∩ assigned members; Member → self only.

```
request → authenticate (JWT)
        → tenantContext (subdomain ↔ token match, RLS var set)
        → planFeatureGuard('classes')      # plan-gated module? 403 FEATURE_NOT_AVAILABLE
        → authorize('members:create')      # coarse: permission in cached set?
        │    Redis key perm:{userId}:{perm_ver} — the perm_ver JWT claim bumps on any
        │    role change, invalidating instantly without token revocation
        → controller → service
             → policy check                # fine: THIS user on THIS row (branch/ownership)
             → repository (scoped client)  # + RLS as final backstop
```

Deny by default — every route declares its permission explicitly; a route without one fails a CI lint. All denials are audit-logged.

## 9. Subdomain Routing Flow

### 9.1 DNS & Edge

- Cloudflare wildcard record `*.fitcloud.com` → Nginx origin; wildcard TLS cert (Cloudflare-managed at edge + origin cert). New tenants need **zero DNS work** — provisioning only inserts a row.
- Reserved slugs (blocked at registration): `www, admin, api, app, mail, status, docs, cdn, assets, help, blog, staging, ws` + profanity/trademark list.
- Slug rules: `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$`, uniqueness enforced by DB constraint; renames allowed (Enterprise) with 301 from the old slug for 90 days.

### 9.2 Resolution Sequence

```
https://goldgym.fitcloud.com/dashboard
  → Cloudflare → Nginx (Host preserved) → Next.js middleware.ts:
      hostname == fitcloud.com / www      → (landing) routes
      hostname == admin.fitcloud.com      → (admin) routes
      else slug = first label             → rewrite to (portal)/… with slug ctx
  → portal layout fetches GET /api/v1/public/tenants/resolve?slug=goldgym
      Redis t:slug:goldgym (miss → DB → cache 5 min)
      returns { tenantId, name, branding, status }
      not found → /tenant-not-found · suspended → suspended page (owner sees pay CTA)
  → branding applied to shell (logo, theme tokens) before login screen renders
API side: every /api/v1 request under a tenant realm re-resolves slug (Origin/Host
header) → must equal JWT tenant_id. The client never “tells” the API its tenant.
```

Local dev mirrors prod: `*.fitcloud.local` via dnsmasq/hosts entries + Nginx in compose — subdomain logic is exercised from day one, not stubbed.

## 10. Subscription Flow

### 10.1 Registration → Trial → Active

```
fitcloud.com/register
  1. Gym name → live slug availability check → owner email/password → plan choice
  2. POST /api/v1/platform/registration   (idempotency-key)
  3. PROVISIONING SAGA (BullMQ, resumable steps, each idempotent):
       a. create tenant (status=trial) + tenant_settings defaults
       b. create owner user + Owner role bindings
       c. seed system roles/permissions, default templates, sample membership plan
       d. create gateway customer · start saas_subscription (trial_ends_at = +14d)
       e. initialize usage counters · send welcome email (verify + portal link)
     any step fails → retry w/ backoff → still failing → compensate (mark tenant
     provisioning_failed, alert ops) — user sees “setting up your portal…” page
  4. https://goldgym.fitcloud.com is live in seconds
```

### 10.2 Purchase / Renewal (gateway = Stripe international; Razorpay adapter for INR — both behind one `PaymentGatewayPort`)

Checkout via gateway-hosted session (card data never touches our servers → SAQ-A). **Webhooks are the source of truth**: signature-verified, idempotency-keyed, enqueued then processed by workers — `payment_succeeded → activate/extend`, `payment_failed → dunning`, `subscription_cancelled → schedule suspension`.

### 10.3 Lifecycle State Machine

```
trial ──pay──► active ──renewal ok──► active
  │ trial ends unpaid                   │ renewal fails
  ▼                                     ▼
expired-trial (portal read-only,     past_due (7-day grace: full function,
 14-day retention → purge)            banners + dunning emails d0/d3/d6)
                                        │ still unpaid
                                        ▼
                                     suspended (staff read-only, member check-in
                                      still works for 14 days — don't punish gym
                                      members for the owner's card failure)
                                        │ 90 days unpaid          │ pays
                                        ▼                         ▼
                                     cancelled → export offer → purge     active
```

- **Upgrade:** immediate, prorated by gateway, limits raised instantly (cache bust).
- **Downgrade:** effective at period end; blocked until current usage fits the target plan's limits (e.g. must archive branches first) — validated up front with a clear checklist.

### 10.4 Limit & Feature Enforcement

- `saas_plans.limits` jsonb → cached per tenant; `tenant_usage_counters` maintained by domain events (member created ⇒ increment) with a nightly reconciliation job against real counts.
- One **PlanLimitGuard** service used by all create-paths: `assertWithinLimit(tenantId, 'max_members')` → 402 `PLAN_LIMIT_REACHED` + upgrade hint payload. Storage limit checked at presigned-upload issuance.
- Features (`chat`, `classes`, `api_access`, `custom_roles`, `white_label`) gate both API (middleware) and UI (capabilities object delivered at login) — UI hides, API enforces.

## 11. Deployment Architecture

### 11.1 Environments

| Env | Runs on | Notes |
|---|---|---|
| dev | docker-compose (PG, Redis, mailpit, all apps, Nginx with `*.fitcloud.local`) | full subdomain parity locally |
| staging | scaled-down prod on AWS, auto-deploy from `develop` | anonymized seed data, own gateway/FCM/Pusher test creds |
| production | AWS multi-AZ | below |

### 11.2 Production (AWS + Cloudflare)

```
Cloudflare (DNS *.fitcloud.com · CDN · WAF · DDoS · bot rules)
  → ALB / Nginx (TLS to origin, ws upgrade, gzip)
     ├─ web (Next.js SSR)      ECS Fargate · 2+ tasks · autoscale CPU/RPS
     ├─ api (Express)          ECS Fargate · 3+ tasks · autoscale
     ├─ realtime (Socket.IO)   ECS · 2+ tasks · sticky sessions · Redis adapter
     ├─ worker (BullMQ)        ECS · autoscale on queue depth
     └─ scheduler              single leader-elected task (repeatable jobs)
  Data: RDS PostgreSQL Multi-AZ (+read replica) behind PgBouncer (RDS Proxy)
        ElastiCache Redis · S3 (media/exports, presigned only) 
        Secrets Manager + KMS (JWT keys, DB creds, gateway keys)
  Email: SES via Nodemailer · Push: FCM · Pusher (managed)
Observability: CloudWatch + OpenTelemetry → Grafana (metrics/traces),
        Winston JSON → CloudWatch Logs (→ OpenSearch), Sentry (web/api/mobile)
```

**Containers over PM2:** Docker on ECS is the primary model — orchestrator handles restarts/replicas, so PM2 inside containers is redundant (anti-pattern). PM2 is sanctioned only for an optional low-cost single-EC2 bootstrap phase (`pm2-runtime` per service); the Dockerfiles don't change, so graduating to ECS is a redeploy, not a rewrite.

**Ops policies:** multi-stage Dockerfiles, non-root, alpine/distroless, Trivy-scanned, tagged by git SHA (never `latest`); rolling deploys with health checks + auto-rollback; migrations as a separate pre-deploy job (expand/contract keeps N and N-1 code compatible); graceful shutdown (SIGTERM → drain HTTP, tell sockets to reconnect, finish in-flight jobs, close pools); daily snapshots + WAL PITR (RPO ≤ 5 min, RTO ≤ 1 h, quarterly restore drills); cross-region snapshot copies + region-evacuation runbook.

## 12. CI/CD Strategy

GitHub Actions + Turborepo remote cache (affected-only).

```
PR (must be green to merge)
  install → lint + typecheck (+ dart analyze) → unit tests
  → integration tests (PG + Redis service containers)
  → prisma migrate diff (schema drift fails) → build affected
  → security: pnpm audit · gitleaks · Semgrep SAST
  → e2e smoke (Playwright, incl. subdomain flows) on labeled PRs

develop merge → build images (SHA tags) → push ECR → deploy STAGING
              → full e2e vs staging (registration→provisioning→login→CRUD)
              → notify Slack

main merge   → promote staging-verified images (no rebuild)
              → manual approval (environment protection)
              → migration job → rolling deploy PROD
              → synthetic post-deploy checks (login, tenant resolve, socket
                handshake, webhook echo) → auto-rollback on failure

mobile       → analyze/test/build → Fastlane: internal track + TestFlight on
               develop · store release on tagged main (staged rollout 10→100%)
```

Feature flags decouple deploy from release — unfinished work ships dark. Rollback = redeploy previous image tag; DB never rolled back (expand/contract discipline). semantic-release on Conventional Commits for changelogs/tags; API versioning independent via `/api/v1`.

## 13. Security Strategy

**Identity** — argon2id hashing; rotating refresh tokens + reuse detection (§7); MFA mandatory for Super Admin & Owner, per-tenant policy for staff; lockout with exponential backoff; session/device list with remote revoke.

**Tenant isolation** — the three layers (§6.2) + prefixed Redis keys, tenant-pathed S3, tenant-scoped sockets and jobs; cross-tenant attempt ⇒ 403 + audit + alert on repetition.

**API hardening** — helmet (CSP, HSTS, X-Frame-Options deny, nosniff); CORS allowlist = `https://*.fitcloud.com` + exact admin/landing origins; CSRF: auth cookie is `SameSite=Lax` + state-changing routes require the Bearer header (cookie alone never authorizes a mutation) — classic CSRF is structurally dead, plus Origin-header validation; rate limiting (Redis sliding window) per IP (unauth), per user + per tenant (auth), strict tiers on login/register/slug-check; Zod validation on every body/query/param/webhook/job payload; Prisma parameterization — raw SQL requires review; XSS: React/Flutter escape by default, CSP as backstop, no `dangerouslySetInnerHTML`, user uploads served from S3 with content-type enforcement (never inline-rendered HTML); idempotency keys mandatory on payment + registration endpoints; webhooks verified by HMAC signature + timestamp window.

**Data** — TLS 1.3 edge-to-origin; AES-256 at rest (RDS, S3, backups); field-level encryption for health data and documents; PII masked for low-privilege roles; GDPR export + erasure workflows; card data never touches our servers (hosted checkout → SAQ-A).

**Secrets & supply chain** — AWS Secrets Manager/KMS only (no secret env files in repo); gitleaks push protection; Dependabot + weekly audits; pinned base-image digests; SBOM per release.

**Audit & detection** — append-only `audit_logs` (who/what/before/after/ip) for all sensitive mutations and every authz denial; impersonation double-logged; anomaly alerts (login velocity, mass export, off-hours admin); quarterly access reviews; annual pentest.

## 14. Coding Standards

- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`; `any` banned (use `unknown` + narrowing); non-null `!` requires a justifying comment; typescript-eslint strict + Prettier, zero warnings on changed files in CI.
- **Boundaries validate, interiors trust:** Zod at every ingress (HTTP, env, queue payloads, webhooks, socket events) from `packages/validation` — the same schemas power React Hook Form resolvers on web.
- **Layer discipline:** controllers thin (parse → service → respond); services never see `req/res`; repositories are the only Prisma consumers; DI via constructor injection (awilix) — no service locators, no singletons holding request state.
- **Async hygiene:** no floating promises (lint-enforced); every handler/job idempotent; all external calls wrapped with timeouts + typed errors.
- **API responses:** uniform envelope — success `{ data, meta }`, error RFC 7807 problem+json (§17). Cursor pagination for feeds, offset for admin tables.
- **Next.js:** Server Components by default, `'use client'` only where needed; data access only through TanStack Query hooks in `features/*/api`; forms = React Hook Form + shared Zod resolver.
- **Flutter:** `very_good_analysis`; freezed immutable states/models; no logic in widgets — BLoC only; single-purpose use-cases.
- **Docs & tests as gates:** every endpoint carries Swagger annotations (undocumented ⇒ CI fail); coverage floor 80 % on `application` + `domain`; integration tests must include at least one cross-tenant-denial test per module; ADR required for significant decisions.

## 15. Naming Convention

| Artifact | Convention | Example |
|---|---|---|
| DB tables / columns | `snake_case`, tables plural | `membership_plans.next_bill_at` |
| Prisma models | `PascalCase` singular + `@@map` | `MembershipPlan` |
| TS files | `kebab-case` + role suffix | `member.service.ts`, `member.prisma-repository.ts` |
| Classes/types/enums | `PascalCase` | `PlanLimitGuard`, `InvoiceStatus` |
| Functions/vars | `camelCase`, verb-first fns | `calculateProration()` |
| Constants / env | `SCREAMING_SNAKE_CASE` | `JWT_ACCESS_TTL` |
| React components | `PascalCase` | `MemberTable.tsx` |
| Hooks | `use` prefix | `useCheckIn` |
| REST paths | plural kebab-case nouns, no verbs | `POST /api/v1/class-bookings` |
| Permissions | `resource:action` | `payments:refund` |
| Domain/socket events | `noun.past_tense` | `member.enrolled`, `attendance.checked_in` |
| Queues/jobs | kebab-case | `notifications-email`, `expire-memberships` |
| Redis keys | `t:{tenantId}:{domain}:{id}` | `t:9f3…:settings` |
| Dart files | `snake_case` | `check_in_bloc.dart` |
| Tenant slugs | `[a-z0-9-]`, 3–40 chars | `goldgym` |

## 16. Git Branch Strategy

- **GitHub Flow + staging branch:** `main` = production, always deployable; `develop` = staging integration; short-lived branches (< 3 days, small PRs).
- Branch names: `feat/FIT-123-class-waitlist` · `fix/…` · `chore/…` · `hotfix/…` (ticket mandatory).
- **Conventional Commits** enforced by commitlint (`feat(members): add freeze endpoint`) → automated changelog + semantic-release.
- PR rules: template (what/why/tests/screenshots), ≥ 1 approval — **2 + CODEOWNERS for `core/`, `auth`, `payments-gateway`, `tenant-management`, `prisma/schema.prisma`** — squash merge only, linear history.
- Hotfix: branch off `main` → tag → deploy → back-merge to `develop`. No force-push to protected branches; signed commits on `main`; secret-scanning push protection.

## 17. Error Handling Strategy

- **Typed hierarchy:** `AppError(code, httpStatus, message, details?)` → `ValidationError` 422 · `AuthenticationError` 401 · `AuthorizationError` 403 · `NotFoundError` 404 · `ConflictError` 409 · `PlanLimitError` 402 · `TenantSuspendedError` 403 · `RateLimitError` 429 · `ExternalServiceError` 502. Stable machine-readable `code` strings (`PLAN_LIMIT_REACHED`, `TOKEN_REPLAYED`) — a documented catalog shared with web/mobile via `shared-types`.
- **Single global Express error middleware:** maps AppError → RFC 7807 problem+json (`type, title, status, code, detail, errors[], traceId`); unknown errors → generic 500, full stack only to Winston + Sentry — **never** stack traces, SQL, or internal paths to clients.
- **Async safety:** promise rejections funneled to the middleware (wrapped router); `unhandledRejection`/`uncaughtException` → log fatal → graceful shutdown → orchestrator restarts.
- **Job errors:** retries with exponential backoff + jitter (per-queue policy, §22) → dead-letter queue → DLQ depth alerting; every failure logged with job id + tenant id.
- **External calls** (gateway, SES, FCM, Pusher): timeouts, limited retries on idempotent ops, circuit breaker; degrade gracefully (payment provider down ⇒ queue and inform, not 500).
- **Frontend:** Axios interceptor maps the error catalog to UX (401 → silent refresh → login; 402 → upgrade dialog; 403 feature → gated screen; 422 → field errors via RHF). React error boundaries per route group; TanStack Query retry only on idempotent GETs. **Mobile:** Dio interceptor mirrors the same mapping; BLoC emits typed failure states.

## 18. Logging Strategy

- **Winston, structured JSON**, one line per event: `timestamp, level, message, service, env, version(git sha), traceId, requestId, tenantId, userId, module`. Correlation via AsyncLocalStorage — every log line inside a request/job automatically carries its context; `traceId` propagates web → api → jobs → notifications (and is returned in error responses).
- Levels: `error` (actionable), `warn` (degraded/suspicious — authz denials, limit hits, webhook signature failures), `info` (business events: enrolled, paid, provisioned), `http` (access log), `debug` (dev only). Prod = `info`.
- Transports: console (stdout) → container runtime → CloudWatch Logs → OpenSearch for search/dashboards; `error` also → Sentry with context. No file transports in containers; PM2-phase uses the same stdout contract.
- **Redaction is mandatory:** central redactor strips passwords, tokens, cookies, card fields, OTPs, health data; PII (email/phone) logged masked. Lint rule bans `console.log` outside the logger module.
- Retention: `http` 30 d · `info` 90 d · `warn/error` 1 y (compliance exports to S3 Glacier). Audit logs are a **database** concern (§5), not a logging concern — logs are operational, audit is legal.

## 19. Notification Strategy

**Event-driven fan-out — nothing sends inline:**

```
domain event ──(same DB tx)──► outbox_events
  → outbox dispatcher → BullMQ notifications queue
  → Orchestrator worker:
      rule(event) → recipients (member / trainer / manager / owner)
      × per-user channel preferences + quiet hours (tenant timezone)
      × template resolution: tenant override → system default (locale-aware,
        tenant branding variables injected)
  → one job per (recipient × channel), each queue with its own retry/backoff + DLQ:
      email  → Nodemailer/SES        push  → FCM (mobile)
      sms    → provider adapter       in-app → notifications row + realtime emit
      pusher → announcement channels  webhook→ tenant endpoints (HMAC-signed)
```

- **Reliability:** outbox ⇒ at-least-once; idempotency key per notification ⇒ effectively once.
- **Categories & control:** transactional (receipts, security) — unmutable; operational (bookings, renewals) and marketing (campaigns) — per-user preference matrix, marketing strictly opt-in. Low-priority events coalesce into digests; per-user and per-tenant rate caps; SMS quota per plan (cost guard).
- **Scheduled campaigns (§22 scheduler):** membership expiry T-7/T-3/T-0 · payment due · class reminder T-2h · birthdays · inactivity win-back · trial-ending (platform plane) · dunning sequence.
- Delivery status tracked per notification (sent/delivered/failed/read) → visible to gym owners for member communications.

## 20. Real-Time Communication Strategy

**Division of labor** — Socket.IO = interactive, stateful, tenant-scoped UX; Pusher = broadcast alerts that must also reach backgrounded mobile (paired with FCM):

| Socket.IO (self-hosted gateway) | Pusher (managed) |
|---|---|
| Live attendance board & occupancy | System notifications fan-out |
| Dashboard live tiles | Tenant-wide announcements |
| Chat (member ↔ trainer/staff) | Membership renewal alerts |
| Live member status (in-gym now) | Platform → tenant broadcasts |

- **Gateway:** dedicated `apps/realtime` (no business logic), N replicas, sticky sessions, **Redis adapter** so any api/worker publishes to `realtime:events` and any gateway node delivers. Handshake = access JWT (RS256 public-key verify); expired token ⇒ forced re-auth or disconnect.
- **Rooms (server-assigned only — client-requested joins are authorized server-side):** `t:{tenantId}` · `t:{id}:branch:{id}` · `t:{id}:user:{id}` · `t:{id}:role:{role}` · `t:{id}:chat:{threadId}`.
- **Event catalog (representative):** `attendance.checked_in` → branch room (live board) · `occupancy.updated` → branch+tenant · `dashboard.kpi_updated` → role:manager/owner · `chat.message_created` → thread room (+FCM if recipient offline) · `member.status_changed` → branch · `notification.created` → user room (badge).
- **Contract rules:** realtime is *advisory* — REST is the source of truth; clients reconcile by TanStack Query invalidation keyed off events. Payloads = IDs + minimal fields, never full sensitive records. Per-socket rate limits + payload caps. Chat messages persist through the REST/service path first; the socket layer only announces.

## 21. Caching Strategy

**Redis, cache-aside, with event-driven invalidation** (TTL is the safety net, events are the correctness mechanism — writes publish `cache.invalidate` keys through the outbox):

| Data | Key | TTL | Invalidation |
|---|---|---|---|
| Tenant resolve (slug→id,status) | `t:slug:{slug}` | 5 m | tenant status/slug change |
| Tenant settings/branding | `t:{id}:settings` | 5 m | settings update |
| Plan limits + features | `t:{id}:plan` | 15 m | subscription change |
| Usage counters | `t:{id}:usage:{metric}` | ∞ (counter) | domain events + nightly reconcile |
| Permission set | `perm:{userId}:{perm_ver}` | 30 m | `perm_ver` bump (self-invalidating key) |
| Dashboard aggregates | `t:{id}:dash:{branch}:{date}` | 60 s | TTL only (cheap staleness) |
| Session denylist (jti) | `deny:{jti}` | = token TTL | expiry |
| Rate-limit windows | `rl:{scope}:{id}` | window | expiry |
| Idempotency responses | `idem:{tenant}:{key}` | 24 h | expiry |

Rules: **every key carries a TTL** (no immortal cache except counters); every cached read has a DB fallback path; stampede protection on hot keys (single-flight lock); Next.js layer adds RSC/`fetch` caching for public data (pricing, landing) with tag-based revalidation; TanStack Query is the client cache (staleTime per resource; invalidated by socket events); logical separation of Redis usage (cache / queues / socket adapter / rate-limit) via prefixes now, separate clusters at scale (§24).

## 22. Background Job Strategy

**BullMQ on Redis, dedicated `apps/worker` process** (same domain modules via DI — jobs call the same services as controllers; no duplicated logic).

| Queue | Jobs | Policy |
|---|---|---|
| `provisioning` | tenant-setup saga steps | 5 retries, exp backoff, compensation on final failure |
| `notifications-{email,sms,push}` | channel sends | per-channel retry/backoff, DLQ, rate caps |
| `billing` | gateway webhook processing, dunning steps, invoice PDF | idempotent, 24 h retry window |
| `memberships` | expiry sweeps, renewal reminders, auto-freeze ends | scheduled (repeatable) |
| `reports` | materialized-view refresh, scheduled report exports | low priority, off-peak |
| `maintenance` | counter reconciliation, session purge, cancelled-tenant data purge, S3 temp cleanup | scheduled |
| `webhooks` | tenant webhook deliveries | HMAC-signed, 8 retries, DLQ visible to tenant |

Rules: every job payload carries `{tenantId, traceId, idempotencyKey}` and the worker re-establishes tenant context (incl. RLS var) before any DB access; **all jobs idempotent** (safe re-delivery); repeatable jobs owned by the single leader-elected scheduler task; per-tenant concurrency caps (fairness); priority lanes (transactional email > digest); observability — queue depth, job age, failure rate per queue exported to metrics with SLO alerts (lag > 30 s on transactional queues pages someone); DLQ replay tooling for ops.

## 23. Mobile Architecture

**One Flutter app serves every gym** — tenant identity is data, not build config.

### 23.1 Tenant Onboarding (first launch)

```
1. User enters slug (“goldgym”) OR scans the gym's QR code
   (QR payload: {slug, tenantId, apiBaseUrl, sig} — signed by platform key)
2. GET /api/v1/public/tenants/resolve?slug=goldgym
   → { tenantId, name, branding(logo, colors), status }
3. Persist to flutter_secure_storage: tenant profile + slug
4. App re-themes to the gym's branding → login screen
5. Every subsequent request: Dio interceptor injects X-Tenant-Slug header
   (server still derives authority from the JWT — the header is routing hint only)
Multi-gym users: stored tenant profiles list → switcher on the login screen only
(never after login — a session is always single-tenant, matching web).
```

### 23.2 Layers (mirrors backend Clean Architecture)

- `presentation` — **BLoC** (`flutter_bloc`): events in, states out; screens are dumb renderers; freezed states.
- `domain` — entities + use-cases (`CheckInMember`, `BookClass`, `PayInvoice`) + repository interfaces.
- `data` — repository impls composing **remote** (Dio: auth interceptor, single-flight token refresh, retry, tenant header, error mapper) and **local** (Drift/SQLite cache; `flutter_secure_storage` for tokens + tenant profile).
- DI `get_it` + `injectable` · navigation `go_router` with auth/role guards · models generated from the backend OpenAPI spec (no hand-written drift) · flavors dev/staging/prod.

### 23.3 Offline & Sync

| Data | Policy |
|---|---|
| Profile, membership, workout/diet plans | cache-first, background refresh |
| Class schedules | cached with TTL; booking requires connectivity |
| Check-in QR | offline-capable: rotating signed code from a provisioned per-member secret; validator syncs later |
| Trainer notes/assessments | local write queue → sync with idempotency keys; conflict = last-write-wins + flag |

### 23.4 Realtime & Push

- Foreground: Socket.IO client (JWT handshake) for chat, live class seats, occupancy.
- Background: **FCM** (data + notification messages) via the notifications pipeline; Pusher channels for announcement streams; silent pushes trigger targeted cache invalidation; deep links route into screens (booking, invoice, chat thread).
- **Kotlin platform channels** (Android): biometric prompt, NFC/BLE turnstile check-in, Health Connect sync, QR scanning optimizations. Swift equivalents on iOS.
- Security: certificate pinning; tokens only in secure storage; jailbreak/root detection (warn-mode); no PII in local logs.

## 24. Scalability Strategy

**Phase 1 — Launch (≤ ~300 tenants).** Architecture as deployed in §11: 3× api, 2× web/realtime, one worker pool, RDS Multi-AZ + 1 replica, one Redis. Stateless services + HPA already give headroom. Targets: p95 API < 300 ms, socket handshake < 1 s.

**Phase 2 — Growth (~300–3,000 tenants).**
- Read path: Prisma read/write client split → reports & dashboards to read replicas; materialized views carry analytics; Redis hit-rate as a tracked SLO.
- Write path: RDS Proxy/PgBouncer transaction pooling; hot tables already partitioned; workers autoscale on queue depth.
- Split Redis into three (cache / BullMQ / socket pub-sub) — isolated failure domains.
- Noisy-neighbor controls become active levers: per-tenant rate limits, job concurrency caps, per-tenant socket connection budgets.
- Realtime scales on connection count (adapter already in place).

**Phase 3 — Scale (3,000+ tenants, multi-region).**
- Extract along module seams **in earned order**: notifications → reports/analytics → billing (realtime is already separate). Repository pattern + outbox means extraction = repointing adapters + moving a queue, not rewrites.
- Data: Citus (distribute by `tenant_id`) or graduate Enterprise tenants to **dedicated databases** — sold as an isolation tier; tenant home-region pinning (EU/US/APAC) for data residency, region encoded on the tenant record.
- Analytics: CDC (Debezium) → ClickHouse/warehouse; OLAP fully off OLTP.
- Edge: Cloudflare caching for public/semi-static tenant data (class schedules) with event-driven purge.

**Guardrails at every phase:** no server-local state ever; k6 load tests in CI for hot endpoints (check-in, booking, login) with regression budgets; monthly capacity review vs tenant growth; SLOs — 99.9 % API availability, p95 latency, transactional queue lag < 30 s — alerting on burn rate, not static thresholds.

## 25. Future Expansion Strategy

Designed-in extension points (each is an interface/seam today, a feature tomorrow):

- **Public API for tenants** (`api_access` flag exists) — API keys + OAuth client credentials, per-key rate limits, same permission model → integrations/Zapier marketplace.
- **White-label / custom domains** (Enterprise): `gym.customdomain.com` via Cloudflare for SaaS (custom hostnames + automated certs); tenant resolver already supports host→tenant mapping beyond slugs.
- **Marketplace & POS expansion:** inventory module grows into supplements/merch POS; payment adapter port already abstracts gateways; hardware (turnstiles, biometric devices) integrates through the existing check-in API + webhook contracts.
- **Wearables & health platforms:** Health Connect/HealthKit channels exist in mobile; a `fitness-data` ingestion module consumes device webhooks → member progress.
- **AI layer:** workout/diet plan generation, churn prediction (Phase-3 warehouse is the training substrate), member-facing assistant — all consume existing module services; no schema rework needed.
- **Franchise/HQ hierarchies:** tenant→branch already models one level; a `tenant_groups` layer adds multi-tenant ownership (franchise HQ dashboards) without touching isolation (group = read-only aggregation plane).
- **Payment localization:** `PaymentGatewayPort` accepts new adapters (Adyen, Mercado Pago) per region; currency/tax already per-tenant.
- **Microservice extraction:** module boundaries + outbox + DI are the contract; §24 Phase 3 lists the earned order.
- **Native TV/kiosk check-in app:** consumes the same public check-in API + realtime events; no backend change.

Rule for all of it: **new capability = new module behind a feature flag + a plan entry** — the plan/limits system (§10.4) is the monetization switchboard, so packaging changes never require deploys.

---

## Appendix A — Build Order

1. Kernel: monorepo, CI, Docker/compose with local subdomains, auth + tenants + RBAC + audit + error/logging spine
2. Platform plane: registration → provisioning saga → subscriptions + gateway webhooks + limits guard
3. Revenue core: branches, staff, members, memberships, invoices/payments
4. Operations: attendance (+ realtime board), workout/diet plans, trainers
5. Engagement: notifications pipeline, chat, Pusher/FCM, mobile app
6. Reporting + settings/branding polish + super-admin portal hardening
7. Load test, pentest, DR drill → GA

## Appendix B — Day-1 ADRs

- ADR-0001 Modular monolith over microservices for v1
- ADR-0002 Shared-schema multi-tenancy + RLS (3-layer enforcement)
- ADR-0003 Subdomain-as-tenant resolution; no tenant pickers post-login
- ADR-0004 RS256 JWT + rotating refresh tokens with reuse detection
- ADR-0005 Transactional outbox for all side effects
- ADR-0006 Plan limits as data (jsonb) + single PlanLimitGuard
- ADR-0007 Socket.IO (interactive) / Pusher+FCM (broadcast) split
- ADR-0008 Docker/ECS primary; PM2 only for single-VM bootstrap phase
- ADR-0009 TanStack Query = server state, Redux = UI state only
