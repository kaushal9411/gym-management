# Naming Conventions

Single source of truth for names across the platform. CI lint rules enforce the
mechanical ones; reviewers enforce the rest.

## Folder Naming

| Context | Convention | Example |
|---|---|---|
| All folders (TS workspaces) | `kebab-case` | `audit-logs/`, `shared-utils/` |
| Backend module folders | `kebab-case`, plural where collections | `apps/api/src/modules/members/` |
| Module sub-layers | fixed set, singular | `controller/ service/ repository/ dto/ entity/ routes/ middleware/ validator/ events/ interfaces/ types/ tests/` |
| Frontend feature folders | `kebab-case`, feature = noun | `src/features/member-checkin/` |
| Flutter folders | `snake_case` | `lib/features/check_in/` |

## File Naming

| Artifact | Convention | Example |
|---|---|---|
| TS files | `kebab-case` + role suffix | `member.service.ts`, `member.repository.ts`, `create-member.dto.ts` |
| React components | `PascalCase.tsx` | `MemberTable.tsx` |
| Hooks | `use-` prefix, kebab file / camel export | `use-check-in.ts` → `useCheckIn` |
| Tests | mirror the file + `.spec` / `.test` | `member.service.spec.ts` |
| Dart files | `snake_case.dart` | `check_in_bloc.dart` |
| Config files | tool-canonical names | `turbo.json`, `.prettierrc` |

## Component / Code Naming

| Artifact | Convention | Example |
|---|---|---|
| Classes, types, interfaces, enums | `PascalCase` (no `I` prefix) | `PlanLimitGuard`, `InvoiceStatus` |
| Functions & variables | `camelCase`, functions verb-first | `calculateProration()` |
| Constants & env vars | `SCREAMING_SNAKE_CASE` | `MAX_FREEZE_DAYS`, `JWT_ACCESS_TTL` |
| Redux slices | `<feature>Slice` | `authSlice` |
| BLoCs | `<Feature>Bloc` / `<Feature>Event` / `<Feature>State` | `CheckInBloc` |
| Domain/socket events | `noun.past_tense` | `member.enrolled`, `attendance.checked_in` |
| BullMQ queues/jobs | `kebab-case` | `notifications-email` |
| Redis keys | `t:{tenantId}:{domain}:{id}` | `t:9f3…:settings` |
| Permissions | `resource:action` | `payments:refund` |
| npm packages | `@gym-saas/<workspace>` | `@gym-saas/tenant-web` |

## API Naming

- Paths: plural `kebab-case` nouns, **no verbs** — `POST /api/v1/class-bookings`
- Versioning: URI prefix `/api/v1` (new major = new prefix, old kept through deprecation window)
- Query params: `camelCase` — `?branchId=&pageSize=`
- Response envelope: success `{ "data": …, "meta": … }` · error RFC 7807 problem+json with stable `code` strings (`PLAN_LIMIT_REACHED`)
- Headers: `X-Tenant-Slug` (routing hint only), `X-Request-Id`, `Idempotency-Key`

## Database Naming

- Tables: `snake_case`, plural — `membership_plans`
- Columns: `snake_case` — `next_bill_at`; booleans read as predicates — `is_active`
- Prisma models: `PascalCase` singular + `@@map("snake_case_plural")`
- PKs: `id` (UUID v7) · FKs: `<entity>_id` · timestamps: `created_at`, `updated_at`, `deleted_at`
- Indexes: `idx_<table>_<cols>` · unique: `uq_<table>_<cols>` · tenant tables always index `(tenant_id, <hot column>)`
- Enums: `snake_case` type name, `SCREAMING_SNAKE_CASE` values

## Branch Naming

`<type>/<ticket>-<short-kebab-description>` — types: `feature/ bugfix/ release/ hotfix/`
Examples: `feature/FIT-123-class-waitlist`, `hotfix/FIT-501-refresh-rotation`, `release/1.4.0`

## Commit Naming (Conventional Commits — enforced by commitlint)

`<type>(<scope>): <imperative summary>` — types: `feat fix chore docs refactor perf test build ci`
Examples: `feat(members): add membership freeze endpoint` · `fix(auth): rotate refresh token on reuse`
Breaking changes: `!` after type/scope + `BREAKING CHANGE:` footer.

## Environment Naming

- Environments: `development` · `staging` · `production` (never abbreviations in config)
- Env files: `.env.example` (committed) · `.env` (local, ignored) · `.env.production` (injected at deploy, never committed)
- Env vars: `SCREAMING_SNAKE_CASE`, grouped by prefix — `DATABASE_URL`, `SMTP_HOST`, `PUSHER_KEY`
- Client-exposed vars: `NEXT_PUBLIC_` prefix only, never secrets
- Tenant slugs: `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$`, reserved list: `www admin api app mail status docs cdn assets help blog staging ws`
