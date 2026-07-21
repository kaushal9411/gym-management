# Frontend Guide (`apps/tenant-web`, plus super-admin notes)

Next.js 15 App Router, Tailwind, shadcn-style components, Redux Toolkit + redux-persist, TanStack Query, axios.

## State rules (strict, established conventions)

- **TanStack Query owns ALL server state.** Redux holds only UI/session state. Never mirror API data into Redux.
- Redux slices (`src/store/index.ts`): `auth` (persisted; user + permissions + tokens), `navigation` + `branch` (persisted), `ui`, and **read-only mirrors** `theme` (of next-themes) and `tenant` (of server-resolved TenantProvider) — mirrors are NOT persisted on purpose (single source of truth lives elsewhere; sync bridges: `theme-store-sync.tsx`, `tenant-store-sync.tsx`).
- **Do not call mutations from mount effects via TanStack `useMutation`** — under React 19 StrictMode the observer can stay `pending` forever (bug proven & fixed in onboarding success-step). For fire-on-mount calls use a direct service call + local `useState` machine + `useRef` once-guard (see `features/onboarding/components/steps/success-step.tsx`).

## Provider stack (`src/providers/app-providers.tsx`)

Redux → PersistGate → QueryClient → ThemeProvider(+ThemeStoreSync) → TenantProvider(+TenantStoreSync) → AuthProvider → RealtimeProvider → chrome (TopProgressBar, SessionExpiryModal, Toaster).

## Multi-tenancy on the client

- `src/middleware.ts` extracts slug from Host (`{slug}.localhost:3001` / `{slug}.<domain>`), `?tenant=` override, or cookie → header `x-tenant-slug`.
- Root layout resolves tenant server-side (`features/tenant/resolve.ts` → `GET /public/tenants/resolve`) and paints branding CSS vars on `<body>` (`--primary`, `--tenant-secondary`). Unknown slug → `PLATFORM_TENANT` fallback; `/login` then renders `FindGymForm` instead of a dead login form.
- `apiClient` (`features/auth/services/api-client.ts`): attaches `X-Tenant-Slug` + Bearer, dedupes identical in-flight requests (AbortController), 401→refresh-once-and-retry, tenant-wide error redirects (suspended/expired/maintenance), dispatches request start/finish for the top progress bar.

## Feature map (`src/features/`)

| Feature | Contents |
|---|---|
| `auth` | services (auth.service + api-client), hooks (use-auth, use-permissions ← `hasPermission/hasAnyRole`, use-current-user, use-logout, use-session), guards (`RequireAuth`, `RequirePermission`, `RequireRole`, `RequireSubscription`, `RequireActiveTenant`), all auth forms/pages incl. invitation-view (wired to real `/invitations/lookup|accept`) |
| `iam` (P11) | `types/`, `services/iam.service.ts` (whole IAM surface), `hooks/use-iam.ts` (all queries/mutations, cache keys `['iam', …]`), components: `iam-nav` (tabs Users/Roles/Permissions/Invitations, permission-filtered), `permission-tree` (grouped bulk-select picker), `role-select`, `role-form`, `branch-access-editor`, `invite-dialog`, `avatar-upload` (canvas → ≤192px JPEG data-URL), `status-badge` |
| `tenant` | types (`Tenant` incl. `featureFlags`, `subscription`), resolve, provider, logo, find-gym-form |
| `onboarding` | 7-step wizard (`/register`), sessionStorage persistence, token handoff builder (`utils/portal-url.ts` — fragment-based, scrubbed on landing) |
| `billing` | plans/checkout/invoices/history/address (P8) |
| `navigation` | `nav-config.ts` (sidebar catalog: permission + featureFlag filtered via `use-filtered-nav`), slice |
| `notifications`, `branch`, `dashboard`, `realtime` (socket + pusher stub + provider), `theme` | P10 shell |

## Routes (`src/app/`)

- `(auth)/`: login, register(status pages), forgot/reset-password, verify-email/otp, two-factor, invitation/[token], status screens. `register/` (own layout) = onboarding wizard; `onboarding-complete` = token handoff landing.
- `(portal)/` (RequireAuth + RequireSubscription + AppShell): dashboard, billing/*, profile, settings (tabs: account/password/notifications/**sessions** — active devices + login history), notifications, support, **users** (+ `new`, `[userId]` detail with roles/branches/overrides editors + effective permissions), **roles** (+ `new`, `[roleId]`), **permissions** (registry + matrix tabs), **invitations**.
- Sidebar entry "Staff & Access" → `/users` (perm `users:read`, flag `staff`); the four IAM pages cross-link via `IamNav` tabs.

## UI kit (`src/components/ui/`)

button, card, dialog, drawer (Dialog-based side sheet), dropdown-menu, avatar, badge, breadcrumb, checkbox, input, label, search-bar, separator, skeleton, sonner(toast), spinner, data-table (generic, loading+empty states), empty-state, statistic-card, chart-wrapper (Recharts), page-container, quick-action-button. Layout shell in `src/components/layout/` (app-shell, sidebar, header, notification-panel, theme-toggle, branch-selector, profile-menu, breadcrumbs, footer).

Patterns: forwardRef + `cn()`; native `<select>` styled inline (no shadcn Select); forms via react-hook-form + zodResolver with schemas in `features/*/schemas` (note: optional `<input type="number">` needs the `''→undefined` preprocess trick — see onboarding schema).

## super-admin (3002)

Own auth stack against `/admin/*`, simple `NAV_ITEMS` sidebar in `(portal)/layout.tsx`, `components/data-table.tsx` + `pagination.tsx`. Independent from tenant-web — don't share state code between them.

## E2E tooling

Playwright lives OUTSIDE the repo in the session scratchpad (`e2e/` with `register-flow.js`, `iam-flow.js`); Chromium already installed under `%LOCALAPPDATA%\ms-playwright`. Pattern: headless run against `http://prompt10test.localhost:3001`, capture console errors, Mailpit API for OTPs/tokens.
