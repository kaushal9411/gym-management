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
| `settings` (P12) | Gym Profile/Branding/Business Settings — see §Settings below. |
| `staff` (P13) | Manager/Trainer/Receptionist management — see §Staff Management below. |
| `members` (P14) | Gym member management + the `MembershipPlan` catalog under `/membership-plans` — see §Member Management below. |
| `members` (P15 addendum) | Membership Plans module expanded the same `members` module in place (no new top-level module) — full plan CRUD/activate/duplicate + member-side downgrade/extend/cancel/resume — see §Membership Plans below. |

## Settings (Gym Profile, Branding & Business Settings — Prompt 12)

`modules/settings/` — same routes→controller→service→repository layout as every other module, but the service (`SettingsService`) fronts FOUR separate 1:1-with-tenant tables through one class, constructed per-request as `new SettingsService(req.tenant!.id, req.tenant!.slug)`:

- `TenantProfile` (new table) — legal/registration/GST-VAT/business-type/description, contact (email/phone/alternatePhone/website/address/city/state/country/postalCode/lat/lng), `businessHours` (Json), `socialLinks` (Json). **Distinct from the pre-existing `BillingAddress`** (P8) — that's FitCloud's billing address *for* the tenant; this is the tenant's own gym address shown to its members.
- `TenantSettings` (extended) — gained `currencySymbol`, `dateFormat`, `timeFormat`, `weekStartDay`, `measurementUnit` (enum METRIC/IMPERIAL), `emailNotificationsEnabled`/`pushNotificationsEnabled`/`smsNotificationsEnabled`, `smsProviderConfig` (Json?, config-only — no SMS actually sends yet).
- `TenantBranding` (extended) — gained `theme` (enum LIGHT/DARK/SYSTEM), `loginBackgroundUrl`, `dashboardBannerUrl`, `emailLogoUrl` (alongside pre-existing logoUrl/faviconUrl/primaryColor/secondaryColor/welcomeMessage).
- `TenantInvoiceSettings` (new table) — `invoicePrefix` (default "INV"), `invoiceFooter`, `taxPercentage`, `defaultPaymentTermsDays`. **Distinct from the platform `Invoice` model** (P8) — that's FitCloud invoicing the tenant for its subscription; this is defaults for invoices the tenant will issue to its own members (Payments module, not yet built).

Both new tables got hand-written RLS migrations (`20260721092400_enable_rls_gym_settings`) per the hard rule.

Endpoints are consolidated by REST resource rather than 1:1 with the prompt's 18 named capabilities (e.g. Currency/Timezone/Date-Time-Format/Language all PATCH the same `/settings/business`; Tax Information PATCHes `/settings/invoice`) — see the Swagger comments in `routes/settings.routes.ts` for the capability→endpoint mapping. Routes: `GET/PATCH /settings/profile`, `PATCH /settings/profile/contact`, `PATCH /settings/profile/business-hours`, `PATCH /settings/profile/social-links`, `GET/PATCH /settings/business`, `GET/PATCH /settings/branding`, `POST /settings/branding/logo`, `POST /settings/branding/favicon`, `POST /settings/branding/upload` (generic, `field` selects loginBackgroundUrl/dashboardBannerUrl/emailLogoUrl), `GET/PATCH /settings/invoice`, `GET/PATCH /settings/email`, `GET/PATCH /settings/notifications`.

**Permissions**: `settings:read` (new, seeded this prompt, granted to MANAGER alongside existing `settings:manage`) gates all GETs; `settings:manage` (pre-existing) gates all writes.

**Uploads**: no object storage exists — same pattern as IAM avatars. Client canvas-downscales to a JPEG data-URL before sending; API just stores/returns the data-URL string (validated by a data-URL regex + ~300KB cap in `uploadImageSchema`). "Public URL" in the prompt spec = the data-URL itself.

**Cache invalidation — load-bearing**: any write that touches `gymName`, `TenantBranding`, or `TenantSettings` MUST call `tenantService.invalidateCache(tenantSlug, tenantId)` (see `SettingsService#invalidateTenantCache`), because `tenantMiddleware` gates every request on the cached `ResolvedTenant`, and the public `/public/tenants/resolve` + login-screen branding read from that same cache. Verified live: PATCHing gym name/primary color and immediately re-querying `/public/tenants/resolve` reflects both instantly.

**Audit**: every mutating method logs via `AuditLogRepository.record` under `settings.*` actions (e.g. `settings.profile.update`, `settings.branding.upload-logo`) — same `actorFrom(req)` pattern as IAM.

## Staff Management (Manager/Trainer/Receptionist — Prompt 13)

`modules/staff/` — routes→controller→service→repository, same shape as every other module, but `StaffService` composes the **existing** IAM repositories rather than reimplementing account CRUD:

- `UserManagementRepository` (from `modules/users`, imported unmodified) handles create/update/setStatus/softDelete/restore/setRoles/setBranches/findByEmail/findByPhone/ownerUserIds — reused as-is.
- `StaffProfileRepository` (new, in this module) owns the 1:1 `StaffProfile` table: `employeeId` (unique per tenant, auto-generated as `EMP-0001`, `EMP-0002`, … via a count-based sequence with retry-on-conflict — editable afterward), `firstName`/`lastName` (kept off `User` itself; `User.name` is derived as `"${firstName} ${lastName}"` so every other part of the app — auth, sessions, audit, notifications — keeps working against the field it already expects), gender, dateOfBirth, joiningDate, address, notes, and the Employment Information group (employmentType/salaryType/salaryAmount/shift/weeklyOff/workStatus enums+fields).
- `StaffRepository` (new) does the role-filtered `User` joins for list/detail (`userRoles.some({role:{name: in ['MANAGER','TRAINER','RECEPTIONIST']}})` + `staffProfile: true` include) — kept separate from `UserManagementRepository`'s generic list/detail so the generic Users/IAM screens are untouched (zero regression risk).
- Emergency contact, avatar, and account status (`ACTIVE`/`SUSPENDED`/`DEACTIVATED`/`PENDING_VERIFICATION`/`LOCKED` + soft-delete) all reuse the existing `User` columns from IAM (Prompt 11) — **not** duplicated onto `StaffProfile`.

**Staff types**: exactly `MANAGER` | `TRAINER` | `RECEPTIONIST` (`STAFF_ROLE_NAMES` in `dto/staff.dto.ts`) — the Owner already exists via the `OWNER` system role and is never touched here. A staff member holds exactly one of these three roles (unlike generic Users, which can hold several) and always has an explicit branch list with exactly one primary (`allBranches` is forced `false` — no "all branches" shortcut like generic IAM users get).

**Create Staff → activation flow (the one genuinely new piece of infrastructure)**: unlike the existing `invitations` module (which creates the `User` row only when the invite is *accepted*), Create Staff needs the full profile/employment data up front, so it creates the `User` row immediately (`status: PENDING_VERIFICATION`, an unusable random password) and then mints an activation link using the **PasswordReset** token machinery (`VerificationRepository.createPasswordReset` + `hashToken`/`generateOpaqueToken` from `core/security/token.util.ts`) instead of the `UserInvitation` table — a 7-day-TTL token (`STAFF_ACTIVATION_TTL_HOURS`) rather than the 48h invite / 30-min reset-password TTLs. The email reuses the **existing invitation email template** (`buildInvitationEmail`, re-exported from `authentication/events/auth-email.listeners.ts` for exactly this kind of reuse) via a new `staff.activation_requested` event + listener (`staff/events/staff-email.listeners.ts`, registered in `server.ts`), pointing the accept link at `/staff-activation/{token}` instead of `/invitation/{token}`. `POST /staff/activation/accept` (public) consumes the token via the same `consumePasswordReset` used by self-service "forgot password", sets the password, and flips `PENDING_VERIFICATION → ACTIVE` — this is "Set Password" + "Activate Account" from the prompt spec in one step. `POST /staff/:id/reset-password` (admin-triggered "Reset Password") is a thin wrapper that reuses `AuthEvents.PasswordResetRequested` + the **existing** password-reset email listener verbatim — no new template needed there.

**Subscription staff limits — built from scratch**: before this prompt, `TenantLimit.maxManagers/maxTrainers/maxReceptionists/maxStaff` were written at provisioning time but **never read anywhere** — no enforcement existed. `StaffService#assertStaffCapacity(role)` now checks both the per-role cap and the total-staff cap on every Create Staff / Assign Role call, comparing against a live `COUNT` of non-deleted users holding that role. Verified live: creating a 6th MANAGER on a plan with `maxManagers: 5` is correctly rejected with `409 CONFLICT`.

**Permissions**: `staff:view`, `staff:create`, `staff:update` (also gates the admin-triggered Reset Password action), `staff:delete`, `staff:restore`, `staff:activate` (covers activate/deactivate/suspend — the spec didn't need separate keys for each transition), `staff:invite` (send/resend activation), `staff:assign-branch`, `staff:assign-role` — all granted to MANAGER in the seed, none to TRAINER/RECEPTIONIST (staff don't manage other staff).

**Business rules enforced**: email/phone/employeeId unique per tenant (service-layer checks, same pattern as Users); one primary branch required (`assignBranches` rejects a `primaryBranchId` not in `branchIds`); suspended/deactivated staff can't log in (falls out of the existing `AuthService` status check on `User.status` — no new code needed); soft delete only (`deletedAt` + status flip, restorable).

**Found and fixed while verifying this module**: the API's CORS `methods` allow-list (`app.ts`) was missing `PUT` — this silently blocked every PUT-based action from a real browser, including the **already-shipped** IAM roles/branches assignment buttons (`PUT /users/:id/roles`, `PUT /users/:id/branches`), not just this module's new `PUT /staff/:id/role` / `PUT /staff/:id/branches`. Fixed by adding `'PUT'` to the `methods` array. This had apparently never been caught because no prior live E2E happened to click those specific IAM buttons in a browser (curl-based smoke tests don't enforce CORS).

## Member Management (Prompt 14)

`modules/members/` — two routers: `member.routes.ts` (mounted `/members`) and `membership-plan.routes.ts` (mounted `/membership-plans`), sharing the module's `dto/`, `validators/`, `repositories/`.

**`Member` is a standalone table, NOT a `User` row** — deliberately different from Staff Management. The prompt for this module had no invitation/password/login-flow section (unlike Staff's explicit "Invitation Flow"), so a member here is a pure gym-membership record with its own `MemberStatus` (`ACTIVE`/`INACTIVE`/`FROZEN`) — nothing to authenticate. The pre-existing `MEMBER` system role + its permissions (seeded in Prompt 5: `profile:read`, `bookings:*`, `payments:read`, `chat:use`) stay reserved for a genuinely future member-facing portal that would create real `User` rows at that time — don't conflate the two.

- `MemberRepository` — role-analogous to Staff's `StaffRepository`: joins `branch`, `trainer` (a `User`), `memberships` (full history + `plan`), `freezes` for both list and detail (one include set, `toListItem`/`toDetail` just slice differently — a member's membership count is small enough that this isn't a real cost).
- `MembershipRepository` — `Membership` (one row per period) + `MembershipFreeze` CRUD. Renew/Upgrade never mutate an existing `Membership` row; they flip its status to `SUPERSEDED` and `create()` a new `ACTIVE` one, so "Renewal History" is just `member.memberships` ordered by `createdAt` — no separate history table.
- `MembershipPlanRepository` — the gym's own plan catalog (`MembershipPlan`: name/durationDays/price/isActive). **Distinct from `SubscriptionPlan`** (Prompt 7/8, FitCloud's plan catalog for billing the tenant) — same naming-collision caution as `TenantProfile`/`TenantInvoiceSettings` vs `BillingAddress`/`Invoice` in Prompt 12.
- `MemberDocumentRepository` — `MemberDocument` rows, same inline-data-URL-no-object-storage pattern as everything else in this codebase.

**Membership lifecycle business rules**:
- **One active membership per member** — `assignMembership` throws `409` if a `Membership` with `status: ACTIVE` already exists; caller must Renew or Upgrade instead.
- **Renew**: supersedes the current membership; new `startDate` = old `endDate` if not yet expired (contiguous), else `now` (no gap-filling for a lapsed member) — `endDate = startDate + plan.durationDays`.
- **Upgrade**: supersedes the current membership; new period always starts `now` regardless of the old end date (upgrading takes effect immediately, no waiting out the old plan).
- **Freeze/Unfreeze**: `MembershipFreeze` row created/closed (`unfrozenAt`), `Member.status` flips `ACTIVE ⇄ FROZEN`. `MemberDetailDto.canCheckIn` is a computed, **informational-only** field (`status===ACTIVE && activeMembership.endDate >= now`) — there's no Attendance module yet to actually enforce "frozen/expired members cannot check in," so this just gives the frontend (and a future Attendance module) something to read.

**QR codes**: `qrcode` npm package (newly added this prompt — nothing existed for this before) generates a PNG data-URL server-side from `` `fitcloud-member:${tenantId}:${qrCodeToken}` `` (`qrCodeToken` = `generateOpaqueToken(16)`, same token util as everywhere else). Generated at Create Member time and cached on the row (`qrCodeImageUrl`); `POST /members/:id/qr-code` regenerates both token and image (invalidates any previously-printed/scanned code).

**Trainer/Branch integration**: `trainerId` is a plain FK to `User.id`, validated at write-time to hold the `TRAINER` role in this tenant (`assertTrainerValid` — reuses the exact `userRoles.some({role:{name:'TRAINER'}})` shape from Staff Management, no new Staff-module code needed). `branchId` reuses the existing `Branch` table/validation from `modules/branches`.

**Subscription member limits**: `MemberService#assertMemberCapacity()` mirrors Staff Management's `assertStaffCapacity` pattern exactly — reads `TenantLimit.maxMembers`, counts non-deleted `Member` rows, rejects with `409` at the cap. Verified live by temporarily lowering a tenant's `maxMembers` to 1 and confirming the 2nd create is rejected.

**Permissions**: `members:view`, `members:create`, `members:update` (also covers activate/deactivate/freeze/unfreeze/branch-transfer/QR-regenerate/document upload-delete — the spec's 9 keys didn't include separate ones for these), `members:delete`, `members:restore`, `members:import`, `members:export`, `members:assign-trainer`, `members:assign-membership` (covers assign/renew/upgrade) — granted in full to MANAGER; RECEPTIONIST gets view/create/update/import/export/assign-membership (no delete/restore/assign-trainer, matching the front-desk trust level already established for `members:manage` pre-Prompt-14); TRAINER gets view only. **Note**: the pre-existing speculative `members:read`/`members:manage` keys from the Prompt-5 catalog are untouched (still seeded, still granted) but no route uses them anymore — the new granular keys are what's actually enforced. Membership Plan CRUD reuses the pre-existing `memberships:manage` permission verbatim rather than adding a redundant key.

**Documents**: images go through the same client-side canvas downscale as everywhere else (`fileToDataUrl`); PDFs/other files can't go through a canvas, so a new `fileToRawDataUrl(file, maxBytes)` (same file, `lib/image-to-data-url.ts`) reads them as-is via `FileReader`, capped at 2MB. Backend validator (`uploadMemberDocumentSchema`) accepts any `data:<mime>;base64,` prefix (not just images) up to ~2.2MB of base64 text.

## Membership Plans (Prompt 15)

Extends the Prompt 14 `modules/members/` scaffold in place — no new top-level module, per "extend the established architecture." `MembershipPlanRepository`/`MembershipPlanService`/`membership-plan.controller.ts`/`membership-plan.routes.ts` all grew rather than being replaced.

**`MembershipPlan` field additions** (all on the same table, `membership_plans`): `planCode` (auto-gen `PLAN-0001`-style + editable, unique per tenant, same count-based-sequence-with-retry pattern as Staff's `employeeId`/Member's `memberId`), `category`, `durationValue`+`durationType` (new `DurationType` enum: DAYS/WEEKS/MONTHS/YEARS — replaces the Prompt 14 assumption that duration is always expressed in days), `joiningFee`/`taxPercentage`/`discountPercentage`, `displayOrder`, `notes`, `deletedAt` (soft delete — **did not exist on this model before Prompt 15**, Prompt 14's plans were hard-catalog-only), and two field groups:
- **Plan Features**: `gymAccessAllBranches`+`accessBranchIds` (Json array, mirrors the `allBranches`/`UserBranch` boolean-or-explicit-list pattern from IAM), `ptSessionsIncluded`, `groupClassesIncluded`, `dietConsultationIncluded`, `lockerAccess`, `guestPasses`, `freezeAllowed`+`freezeDaysLimit`.
- **Membership Rules**: `validityStart`/`validityEnd` (the window the PLAN ITSELF is purchasable in — distinct from a specific `Membership` row's own start/end dates), `gracePeriodDays`, `renewalWindowDays` (0 = anytime), `autoRenewalAllowed`, `minAge`/`maxAge`.

**Calendar-aware duration math** (`modules/members/utils/duration.util.ts`, new file): `addDuration(date, value, type)` uses real `Date.setMonth`/`setFullYear`/`setDate` arithmetic (correct across month-end/leap-year rollover), replacing Prompt 14's flat `addDays(date, plan.durationDays)`. `durationDays` stays on both `MembershipPlan` and `Membership` as an **approximate display cache only** (`approximateDurationDays()`, fixed 30-day/365-day month/year) — never used for actual start/end date computation anymore.

**New plan lifecycle**: Activate/Deactivate (`isActive` toggle), Soft Delete/Restore (`deletedAt` — **`restore()` also resets `isActive: true`**, matching the Member/Staff `restore()` convention of "fully usable in one step," not just un-deleted — this was a real bug caught live during verification: the first draft of `MembershipPlanRepository.restore()` only cleared `deletedAt`, silently leaving a restored plan still inactive and unassignable until a second manual Activate call), Duplicate (`POST /membership-plans/:id/duplicate` — copies every field except `planCode` (freshly generated) and `name` (`"{name} (Copy)"`, incrementing `(Copy 2)` etc. on collision), always created `isActive: false` so a duplicate is never live by accident).

**New member-side membership lifecycle** (on `MemberService`, same file as Prompt 14's assign/renew/upgrade):
- **Downgrade** — literally the same code path as Upgrade (`private changePlan()`), just a different audit action tag (`member.membership_downgraded` vs `_upgraded`) and route (`POST /members/:id/membership/downgrade`) — there is no meaningful business-logic difference between "upgrade" and "downgrade," both supersede the current membership and start a new one effective immediately.
- **Extend** — `POST /members/:id/membership/extend` `{days}` — adds days to the CURRENT membership row's `endDate` in place (no supersede, no new row — this is a correction/bonus on the existing period, not a new period, so it does NOT show up as a separate Renewal History entry).
- **Cancel** — `POST /members/:id/membership/cancel` — flips the current `ACTIVE` membership to `CANCELLED` (an enum value that existed since Prompt 14 but was never actually reachable from any route until now).
- **Resume** — `POST /members/:id/resume`, a straight alias calling the exact same `unfreeze()` service method Prompt 14 already built; the old `POST /members/:id/unfreeze` route is UNTOUCHED (kept for backward compatibility) — both routes now exist side by side.

**New business-rule enforcement in `assignMembership`/`renewMembership`** (private helpers `assertPlanAssignable`/`assertRenewalWindow` on `MemberService`):
- Plan purchase window (`validityStart`/`validityEnd`) — rejects assign/upgrade/downgrade outside the plan's own availability window.
- Age eligibility (`minAge`/`maxAge`) — computed from `Member.dateOfBirth` at assignment time (calendar-correct, accounts for whether the birthday has occurred yet this year); silently skipped if the member has no recorded DOB (can't validate what you don't know).
- Renewal window (`renewalWindowDays`) — a renew is rejected if attempted more than `renewalWindowDays` before the current membership's `endDate` (`0` = no restriction, anytime). Verified live: assigning a plan with `renewalWindowDays: 15` and immediately trying to renew it (membership just started, months from expiry) is correctly rejected with a 422 explaining the window.
- Auto-renewal — `assignMembership` rejects `autoRenew: true` if the plan's `autoRenewalAllowed` is false.

**Permissions**: `memberships:view`, `memberships:create`, `memberships:update` (also covers activate/deactivate/duplicate — no separate keys needed), `memberships:delete`, `memberships:restore`, `memberships:assign`, `memberships:renew` (also covers extend), `memberships:upgrade` (also covers downgrade and cancel — all three are "change what plan/state the current membership is in"), `memberships:freeze` (also covers resume). These are BRAND NEW granular keys that **replace** the old blanket `members:assign-membership` on every membership-lifecycle route under `/members/:id/membership/*`, `/members/:id/freeze`, `/members/:id/unfreeze`, `/members/:id/resume` (the pre-existing `members:assign-membership` key stays seeded but is no longer checked by any route — same "leave the old key as unused legacy" pattern already established for `members:read`/`members:manage` in Prompt 14 and `memberships:manage` below). MANAGER is granted all 9 new keys (zero regression — MANAGER already had `members:assign-membership` covering the same actions). RECEPTIONIST is granted view/assign/renew/upgrade/freeze but deliberately **not** create/update/delete/restore — plan-CATALOG changes stay a Manager-only decision, a real tightening versus the old blanket `memberships:manage` RECEPTIONIST held before (RECEPTIONIST could previously create/edit plans; can no longer). TRAINER is granted view only. Membership Plan CRUD itself (`memberships:create`/`update`/etc.) is enforced on `membership-plan.routes.ts`; the pre-existing `memberships:manage` key (from the Prompt-5 speculative catalog) is left seeded/granted but unused by any route now, exactly like the P14 precedent.

**Verified live**: full plan CRUD including pagination/search/category+status filters; plan-code and plan-name uniqueness rejections; inactive-plan and soft-deleted-plan assignment rejections; minimum-age rejection; renewal-window rejection; the full member-side lifecycle (assign→extend→upgrade→downgrade→freeze→resume→cancel) with `membershipHistory` correctly showing `SUPERSEDED`/`CANCELLED` rows preserved (never deleted) in the right order; 11-endpoint regression pass; full audit trail (11 distinct `membership_plan.*`/`member.membership_*` actions).

## Password hashing (perf fix, Prompt 13.5)

`core/security/password.service.ts` is the one place to hash/verify passwords — use it, don't call a bcrypt-family lib directly (the only other direct call sites, `admin-roles` and `prisma/seed.ts`, exist because they can't import from `src/`). It wraps `@node-rs/bcrypt` (napi-rs, prebuilt binaries, no build step) at `env.security.bcryptSaltRounds` (default 10). This used to be `bcryptjs` (pure-JS) at cost 12, which made login/register/every password path take ~900ms — `bcryptjs` is gone from the repo entirely. The cost factor is embedded in each hash at creation time, so lowering the env default doesn't speed up existing hashes — only newly hashed passwords get the faster cost.

## Prisma / data notes

- Migrations: `prisma/migrations/` — RLS is added via hand-written SQL migrations (`ENABLE/FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy on `tenant_id = current_setting('app.tenant_id')::uuid`). New tenant-scoped tables MUST get one (pattern: `20260708144900_enable_rls_iam_tables`).
- Conventions: UUID PKs, `@@map` snake_case tables, `@map` snake_case columns.
- IAM tables (P11): `user_permissions` (GRANT/DENY, unique user+permission), `user_branches`, `user_invitations` (tokenHash unique). User gained: avatar_url, emergency_contact_*, notification_preferences JSON, permission_version, all_branches, (deleted_at existed). Role gained: priority, is_default, is_active.
- Settings tables (P12): `tenant_profiles`, `tenant_invoice_settings` (new, RLS'd); `tenant_settings`/`tenant_branding` extended (see §Settings above). Both new tables 1:1 with `Tenant` via unique `tenantId`.
- Staff table (P13): `staff_profiles` (new, RLS'd), 1:1 with `User` via unique `userId`, `@@unique([tenantId, employeeId])`. New enums `Gender`, `EmploymentType`, `SalaryType`, `WorkStatus`.
- Member tables (P14): `members` (RLS'd, `@@unique([tenantId, memberId])`, standalone — no `User` relation except optional `trainerId`), `membership_plans`, `memberships`, `membership_freezes`, `member_documents` (all new, RLS'd). New enums `BloodGroup`, `MemberStatus`, `MembershipStatus`, `MemberDocumentType` (reuses `Gender` from P13).
- Membership Plans additions (P15): `membership_plans` gained ~24 new columns (see §Membership Plans above) plus `deleted_at` and `@@unique([tenantId, planCode])` — same table, no new table. New enum `DurationType`. Migration `20260721190000_membership_plans_module` is hand-written (not `prisma migrate dev`, which can't run non-interactively when adding a required column to a table with existing rows) — it adds `plan_code` nullable first, backfills `PLAN-0001`/`PLAN-0002`/... per tenant via a `ROW_NUMBER()` window function, then locks it `NOT NULL` + unique. No RLS migration needed — RLS is table-level and `membership_plans` already had it from Prompt 14.
- Session model = `RefreshToken` (rotating, hashed, family theft-detection) 1:1 `UserSession` (user-visible device row).
- Tokens (invite/reset/verify): `generateOpaqueToken()` + `hashToken()` from `core/security/token.util.ts` — only SHA-256 stored.
