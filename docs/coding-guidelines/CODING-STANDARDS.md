# Coding Standards

Companion to [NAMING-CONVENTIONS.md](./NAMING-CONVENTIONS.md) and
[../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md) (§14).

## TypeScript (api + web + packages)

- `strict: true` + `noUncheckedIndexedAccess` (see `packages/typescript-config`).
- **`any` is banned** — use `unknown` and narrow. Non-null `!` requires a justifying comment.
- ESLint preset `@gym-saas/eslint-config` + Prettier; **zero warnings** on changed files in CI.
- **Boundaries validate, interiors trust**: Zod schemas from `packages/validation` at every
  ingress — HTTP body/query/params, env vars, queue payloads, webhooks, socket events.
  The same schemas power React Hook Form resolvers on the web.
- No floating promises (lint-enforced); all external calls have timeouts and typed errors.
- No `console.*` outside the logger module — Winston structured JSON with correlation IDs.

## Backend layering (Clean Architecture)

- Dependency rule: `controller → service → repository`; domain entities import nothing
  from Express/Prisma/Redis.
- Controllers are thin: parse → call service → map response. Services never touch `req`/`res`.
- Repositories are the **only** Prisma consumers, and they receive only the
  **tenant-scoped client** — the raw client is not injectable into modules.
- Cross-module calls go through application service interfaces (DI/awilix constructor
  injection); side effects (notify, audit, counters) go through domain events → outbox → BullMQ.
- Errors: throw typed `AppError` subclasses with stable `code`s; one global error middleware
  maps to RFC 7807; never leak stacks/SQL to clients.

## Frontend (Next.js)

- Server Components by default; `'use client'` only where interaction demands it.
- **TanStack Query owns all server state; Redux Toolkit owns only UI/session state.**
  Never mirror server data into Redux.
- Data access only via query hooks in `features/<feature>/services|api` — no `fetch`/axios in components.
- Forms: React Hook Form + shared Zod resolver.
- Styling: Tailwind + ShadCN primitives from `packages/ui`; no ad-hoc CSS files per component.

## Flutter

- `flutter_lints` + strict analyzer (see `analysis_options.yaml`).
- No logic in widgets — BLoC only; immutable states; single-purpose use-cases.
- Networking only through the shared Dio client (auth/tenant/error interceptors).
- Tokens & tenant profile only in `flutter_secure_storage`.

## Testing

- Unit: services & domain logic (repositories mocked).
- Integration: repositories against real PostgreSQL + Redis (CI service containers).
- E2E: API happy paths + authorization denials; **every module ships at least one
  cross-tenant-denial test**.
- Coverage floor: 80% on service/domain layers. Tests colocated in each module's `tests/`.

## Documentation gates

- Every endpoint carries Swagger/OpenAPI annotations — undocumented endpoints fail CI.
- Architecturally significant decisions get an ADR in `docs/architecture/adr/`.
- Public exports of shared packages carry TSDoc.

## Review gates

- PRs small (< ~400 lines diff preferred), template filled, CI green.
- 1 approval minimum; 2 + CODEOWNERS for `core/`, `authentication`, `payments`,
  `tenants`, and `prisma/schema.prisma`.
- Squash merge only; linear history.
