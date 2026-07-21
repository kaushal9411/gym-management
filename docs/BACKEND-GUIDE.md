# Backend Guide (`apps/api`)

Express + TS + Prisma + Postgres + Redis + BullMQ. Clean architecture: **routes → controller → service → repository**, per-feature modules under `src/modules/`.

## Core conventions (follow these exactly)

- **Module layout** (plural dirs): `controllers/ services/ repositories/ routes/ validators/ dto/ events/ interfaces/`. Smallest reference module: `modules/branches`. DI-style reference: `modules/authentication` (`utils/auth-module.factory.ts` builds per-request, tenant-bound service).
- **Response envelope**: `sendSuccess(res, data, message?, status?)` / errors thrown as `AppError` subclasses (`core/errors/app-error.ts`: ValidationError 422, NotFoundError 404, ConflictError 409, ForbiddenError 403, UnauthenticatedError 401, RateLimitedError 429) with codes from `core/errors/error-codes.ts`. Never hand-roll JSON.
- **Validation**: zod schemas in `validators/*.validators.ts`, wired with `validate({ body?, query?, params? })` — it PARSES AND REPLACES req fields (coercion applies).
- **Routes**: local `asyncHandler` helper (copy from any routes file), `authenticateMiddleware` then `requirePermission('key')`.
- **Swagger `@openapi` JSDoc trap**: multi-line block YAML is fine; single-line compact annotations MUST be wrapped in one outer flow mapping: `/** @openapi { "/path": { get: {...} } } */` — a bare `/path: get: {...}` one-liner breaks YAML parsing. Quote strings containing `—` or `:` inside flow mappings.
- **Tenant scoping**: `getTenantScopedClient(tenantId)` wraps every query in `set_config('app.tenant_id')` + RLS. Raw `prisma` ONLY for global catalogs / genuinely cross-tenant platform work — always with a comment noting the dev-superuser-bypasses-RLS caveat.
- **Events**: in-process `eventBus` (`core/events/event-bus.ts`), `emitEvent`/`onEvent`; listeners registered in `server.ts` bootstrap (`register*Listeners()` per module `events/` dir).
- **Email**: `enqueueEmail({to,subject,html})` → BullMQ queue `notifications-email`; templates in `infrastructure/mail/templates/` (branded via `tenantService.resolveById`). Dev SMTP = Mailpit.
- **Rate limiting**: `createRateLimiter({windowMs,max,prefix,keyGenerator?})` — Redis-backed, key default `tenantId:ip`.
- **Tests**: Vitest, `src/**/*.spec.ts` only. Integration specs hit the real dev DB.

## Request context

`tenantMiddleware` (global) resolves subdomain / `X-Tenant-Slug` → `req.tenant` (`ResolvedTenant`). `authenticateMiddleware` verifies Bearer JWT → `req.auth` (`AccessTokenClaims`: `sub`, `tenantId`, `role`, `roles[]`, `permVer`, `sid`, `jti`) and asserts `req.tenant.id === claims.tenantId`. Admin portal uses `req.admin` via a separate stack — never mix.

**Billing rescue path**: `assertTenantAccessible` blocks expired trials/subscriptions with 402 on every route EXCEPT `EXPIRY_EXEMPT_PREFIXES` (`/auth`, `/subscription`, `/billing`, `/payment`, `/coupon`, `/invoice` — see `tenant.middleware.ts`), so an expired owner can still log in and pay (`POST /subscription` reactivates tenant + subscription). Suspension/maintenance block everything. Frontend counterpart: trial/subscription-expired status screens link to `/billing` (or `/login` when signed out), and the axios interceptor suppresses expiry redirects while on `/billing`.

## Authorization (the IAM engine — Prompt 11)

**Permission format: `resource:action`** (e.g. `members:read`) — NOT dot format. Catalog seeded in `prisma/seed.ts` (`PERMISSIONS` + `ROLE_PERMISSIONS`); 6 system roles (`tenantId NULL, isSystem`): SUPER_ADMIN, OWNER, MANAGER, TRAINER, RECEPTIONIST, MEMBER. Custom roles are tenant rows.

- **Effective permissions** = union(role perms) + user GRANT overrides − user DENY overrides (DENY always wins). Pure logic: `modules/permissions/utils/effective-permissions.util.ts`; computed in `authentication/repositories/role.repository.ts#getPermissionKeysForUser`.
- **Caching**: Redis `perm:{userId}:{permVer}` (TTL 30m). `permVer` is PERSISTED on `users.permission_version`. `bumpPermissionVersion` increments it AND deletes the old cache key → permission changes bite on the next request even for live tokens.
- **Enforce** with `requirePermission('key')` (middleware) or `permissionEngine` (`modules/permissions/services/permission-engine.service.ts`) for programmatic checks. Role checks: `requireRole(...)` — prefer permissions.
- **Branch access**: `users.all_branches` bool or `user_branches` rows (with `is_primary`, `expires_at` for temporary). Guard single-branch routes with `requireBranchAccess()` / scope queries via `getBranchAccess(tenantId,userId)` (`authentication/middlewares/branch-access.middleware.ts`).
- **Audit**: every IAM write calls `AuditLogRepository.record` (actions `iam.*`) with `actorFrom(req)` (`authentication/utils/actor.util.ts`). Read side: `GET /audit-logs` (perm `audit:read`).

**Any new module (Members, Attendance, …) must**: take `requirePermission` on routes, use `getTenantScopedClient`, write audit records for mutations, and scope branch-sensitive queries via `getBranchAccess`.

## Module → endpoint map (tenant plane, all under `/api/v1`)

| Module (`src/modules/`) | Endpoints (perm) |
|---|---|
| `authentication` | `/auth/*`: register, login, verify-otp/resend, refresh, logout, logout-all, sessions GET/DELETE, forgot/reset/change-password, verify-email, me |
| `users` | `/users` GET(users:read) POST(users:manage); `/users/export`(users:export) `/users/import`; `/users/:id` GET/PATCH/DELETE; `:id/suspend|deactivate|restore` POST; `:id/roles|branches|permissions` PUT |
| `roles` | `/roles` GET(roles:read) POST(roles:manage-custom); `/roles/:id` GET/PATCH/DELETE; `/roles/:id/clone` POST. System roles immutable — clone instead. Delete blocked while assigned. |
| `permissions` | `/permissions` (registry grouped by resource), `/permissions/matrix` (perm `permissions:read`) |
| `invitations` | Public: `/invitations/lookup?token=`, `/invitations/accept` (rate-limited). Staff (users:invite): GET/POST `/invitations`, `:id/resend` POST, `:id` DELETE. 48h TTL, token-hash pattern, statuses PENDING/ACCEPTED/REVOKED/EXPIRED. Accept creates ACTIVE+verified user with invite's role/branches. |
| `sessions` | `/sessions/login-history` (own). Active-session mgmt lives in `/auth/sessions`. |
| `profile` | `/profile` GET/PATCH (self-service: name, phone, avatar data-URL, emergency contact, notification prefs; email change is users:manage only) |
| `audit-logs` | `/audit-logs` GET (audit:read; filters: action prefix, entityType, actorUserId, date range) |
| `tenants` | resolve logic + `tenantMiddleware`; public `/public/tenants/resolve?slug=` |
| `onboarding` | `/onboarding/*`: register→send/verify-otp→plans→select-plan→check-subdomain→payment→create-tenant→status. Redis session `onboarding:session:{id}` TTL 1h, kept (password-hash scrubbed) after provisioning so `status` can confirm. Register rate limit 5/h/IP. |
| `subscription`,`billing`,`payment`,`coupon`,`invoice`,`webhook` | Prompt 8 billing plane (`billing:manage`/`billing:read`) |
| `branches` | `/branches` GET (branches:read) — read-only until Gym Ops prompt |
| `tenant-notifications` | `/notifications` GET, `:id/read`, `read-all`; `notifyTenant`/`broadcast` service APIs; Socket.IO `notification:new` |
| `announcements` | `/announcements/active` |
| `contact` | `/public/contact` POST (platform-plane, no auth/tenant; rate-limited 5/h) — sales/billing inquiries from the expired-trial screens, delivered via the email queue. Frontend: `features/support/components/contact-sales-dialog.tsx` (replaced mailto:, which fails silently without a mail client). |
| `admin-*` (16 modules) | Super-admin plane under `/admin/*` — separate JWT (`admin-jwt.service.ts`), separate tables (AdminUser/AdminRole/AdminAuditLog). Don't touch for tenant features. |

## Prisma / data notes

- Migrations: `prisma/migrations/` — RLS is added via hand-written SQL migrations (`ENABLE/FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on `tenant_id = current_setting('app.tenant_id')::uuid`). New tenant-scoped tables MUST get one (pattern: `20260708144900_enable_rls_iam_tables`).
- Conventions: UUID PKs, `@@map` snake_case tables, `@map` snake_case columns.
- IAM tables (P11): `user_permissions` (GRANT/DENY, unique user+permission), `user_branches`, `user_invitations` (tokenHash unique). User gained: avatar_url, emergency_contact_*, notification_preferences JSON, permission_version, all_branches, (deleted_at existed). Role gained: priority, is_default, is_active.
- Session model = `RefreshToken` (rotating, hashed, family theft-detection) 1:1 `UserSession` (user-visible device row).
- Tokens (invite/reset/verify): `generateOpaqueToken()` + `hashToken()` from `core/security/token.util.ts` — only SHA-256 stored.
