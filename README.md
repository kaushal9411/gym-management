# gym-saas-platform

**FitCloud** — a multi-tenant Gym Management SaaS platform. Thousands of gyms subscribe,
each receiving an isolated, branded portal on its own subdomain
(`goldgym.fitcloud.com`), backed by one shared application with three-layer
tenant isolation.

> 📐 Full architecture (25 sections): [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
> 📏 Standards: [docs/coding-guidelines/](docs/coding-guidelines/)

---

## Project Overview

| | |
|---|---|
| Model | B2B2C SaaS — subscription plans (Starter / Professional / Enterprise) with plan-based limits & features |
| Tenancy | Shared PostgreSQL schema, `tenant_id` + Row-Level Security, subdomain-as-tenant resolution |
| Backend | Node.js · Express · TypeScript · Prisma · PostgreSQL · Redis · BullMQ · Socket.IO |
| Web | Next.js 15 · TypeScript · Tailwind · ShadCN · Redux Toolkit · TanStack Query |
| Mobile | Flutter (BLoC · Dio) — one binary serves every tenant |
| Infra | Turborepo · pnpm · Docker · Nginx · GitHub Actions · AWS · Cloudflare |

## Requirements

- **Node.js ≥ 20.11** (`corepack enable` for pnpm)
- **pnpm 9** (pinned via `packageManager`)
- **Docker Desktop** (PostgreSQL 16, Redis 7, Mailpit, optional Nginx proxy)
- **Flutter SDK ≥ 3.4** (mobile only)
- Hosts entries for local subdomain routing:
  `127.0.0.1 fitcloud.local admin.fitcloud.local api.fitcloud.local goldgym.fitcloud.local`

## Installation

```bash
git clone <repo-url> gym-saas-platform && cd gym-saas-platform
corepack enable
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up -d                 # postgres + redis + mailpit
docker compose --profile proxy up -d # optional: nginx subdomain proxy on :80
```

Mobile (one-time): `cd apps/mobile && flutter create . && flutter pub get`

## Development

```bash
pnpm dev          # all apps via turbo (placeholder scripts until phases land)
pnpm dev --filter @gym-saas/api          # single app
pnpm lint && pnpm typecheck && pnpm test # what CI runs
```

Local URLs: landing `:3000` · tenant portal `:3001` · super admin `:3002` · API `:4000`
(or via nginx proxy: `fitcloud.local`, `{slug}.fitcloud.local`, `admin.fitcloud.local`, `api.fitcloud.local`).
Mailpit UI: `http://localhost:8025`.

## Build

```bash
pnpm build                                  # turbo builds all affected workspaces
docker build -f infrastructure/docker/api.Dockerfile .
docker build -f infrastructure/docker/web.Dockerfile --build-arg APP=tenant-web .
```

## Deployment

- **staging** — auto-deploys from `develop` (`.github/workflows/deploy-staging.yml`)
- **production** — promotes staging-verified images from `main` behind a manual
  approval gate (`.github/workflows/deploy-production.yml`)
- Runbooks: [docs/deployment/](docs/deployment/) · IaC: [infrastructure/terraform/](infrastructure/terraform/)

## Folder Structure

```
gym-saas-platform/
├── apps/
│   ├── landing-web/        # Marketing website — fitcloud.com (pricing, registration entry)
│   ├── tenant-web/         # Gym portal — {slug}.fitcloud.com (Owner, Manager, Trainer,
│   │                       #   Receptionist faces via role-aware layouts)
│   ├── super-admin/        # Platform administration — admin.fitcloud.com
│   ├── api/                # Express backend — platform plane + tenant plane, /api/v1
│   └── mobile/             # Flutter app — every tenant, slug/QR onboarding
├── packages/
│   ├── ui/                 # ShadCN-based design-system primitives (buttons, inputs, dialogs)
│   ├── shared-components/  # Composite app components (data tables, charts, empty states)
│   ├── shared-types/       # DTOs, enums, API contracts, socket event types
│   ├── shared-utils/       # Pure helpers (dates/tz, money, formatting, guards)
│   ├── shared-constants/   # Permission keys, error codes, plan features, reserved slugs
│   ├── shared-config/      # Runtime config schemas & loaders shared across apps
│   ├── api-client/         # Typed API client (axios) generated/derived from OpenAPI
│   ├── validation/         # Zod schemas — single source of truth, web + api + forms
│   ├── eslint-config/      # Shared ESLint preset
│   └── typescript-config/  # tsconfig presets: base / node / nextjs / react-library
├── infrastructure/
│   ├── docker/             # Dockerfiles (api, web) + docker-compose.prod.yml
│   ├── nginx/              # dev.conf / prod.conf — subdomain reverse proxy + ws upgrade
│   ├── github-actions/     # Reusable composite actions (workflows live in .github/)
│   ├── terraform/          # AWS IaC — modules/ + environments/{staging,production}
│   └── scripts/            # Idempotent ops & dev scripts
├── docs/
│   ├── architecture/       # ARCHITECTURE.md (25 sections) + adr/
│   ├── api/  database/  deployment/          # reference docs per concern
│   ├── coding-guidelines/  # CODING-STANDARDS · NAMING-CONVENTIONS · GIT-STRATEGY
│   ├── swagger/            # Exported OpenAPI artifacts
│   └── postman/            # Postman collections & environments
├── .github/workflows/      # ci.yml (lint→build→test) · deploy-staging · deploy-production
├── docker-compose.yml      # DEV backing services (postgres, redis, mailpit, nginx proxy)
├── turbo.json · pnpm-workspace.yaml · package.json · tsconfig.json
└── .editorconfig · .prettierrc · .eslintrc.json · .env.example · .gitignore
```

### Backend module anatomy (`apps/api/src/modules/<module>/`)

22 feature modules (`authentication tenants subscriptions plans users roles permissions
gyms branches members trainers staff attendance membership payments notifications
reports dashboard settings audit-logs chat support`), each with an identical
Clean-Architecture anatomy:

```
<module>/
├── controller/    # HTTP layer — parse request, call service, map response
├── service/       # Use-case orchestration (business rules live here)
├── repository/    # Data access — the ONLY Prisma consumers (tenant-scoped client)
├── dto/           # Request/response shapes
├── entity/        # Domain entities & invariants (framework-free)
├── routes/        # Route table + permission declarations
├── middleware/    # Module-specific middleware
├── validator/     # Zod request validation wiring
├── events/        # Domain events this module emits/handles
├── interfaces/    # Contracts exposed to other modules (DI seams)
├── types/         # Internal module types
└── tests/         # Unit tests colocated with the module
```

Cross-cutting kernel: `src/core/` (middleware, errors, events/outbox, jobs, logging,
security, DI container) · shared adapters: `src/infrastructure/` (database, cache, mail,
sms, push, storage, payments) · versioned mounting: `src/api/v1/`.

### Frontend anatomy (`apps/{landing-web,tenant-web,super-admin}/src/`)

`app/` (Next.js App Router — route groups replace a `pages/` folder) · `features/`
(feature-sliced: each with its own services, components, hooks, store slice) ·
`components/` `layouts/` `hooks/` `store/` `services/` `types/` `constants/`
`utils/` `assets/` `styles/` `providers/` — plus `src/middleware.ts` (added with the
subdomain feature) for tenant resolution and auth guarding.

### Mobile anatomy (`apps/mobile/lib/`)

`core/` (DI, errors, env) · `features/` (data/domain/presentation per feature) ·
`shared/` · `bloc/` (app-level blocs/observers) · `services/` · `repositories/` ·
`models/` · `widgets/` · `routes/` · `theme/` (tenant branding) · `localization/` ·
`network/` (Dio + interceptors) · `storage/` (secure storage wrappers).

## Coding Standards

See [docs/coding-guidelines/CODING-STANDARDS.md](docs/coding-guidelines/CODING-STANDARDS.md)
and [NAMING-CONVENTIONS.md](docs/coding-guidelines/NAMING-CONVENTIONS.md). Highlights:
strict TS, no `any`; Zod at every boundary; repositories are the only Prisma consumers
and only ever see the tenant-scoped client; TanStack Query = server state, Redux = UI
state; every endpoint documented in Swagger or CI fails; every module ships a
cross-tenant-denial test.

## Contribution Guide

1. Branch from `develop`: `feature/FIT-<ticket>-<description>` (see [GIT-STRATEGY.md](docs/coding-guidelines/GIT-STRATEGY.md)).
2. Conventional Commits (`feat(members): …`) — commitlint enforces.
3. Keep PRs small; fill the template; CI (lint → build → test) must be green.
4. 1 approval minimum — 2 + CODEOWNERS for `core/`, `authentication`, `payments`, `tenants`, `prisma/schema.prisma`.
5. Squash merge only. Significant decisions get an ADR in `docs/architecture/adr/`.
