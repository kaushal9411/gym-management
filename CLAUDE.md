# FitCloud (gym-management monorepo)

**Before exploring any code, read these three docs — they replace codebase re-exploration:**

1. `docs/PROJECT-STATE.md` — what's built (prompts 1–11), apps/ports, docker services, dev commands, test credentials, known dev-only caveats.
2. `docs/BACKEND-GUIDE.md` — apps/api conventions (module layout, envelope, zod validate, @openapi trap, tenant scoping/RLS), the IAM permission engine, full module→endpoint map, Prisma notes.
3. `docs/FRONTEND-GUIDE.md` — tenant-web state rules (TanStack vs Redux, read-only mirrors, the mount-effect useMutation trap), provider stack, feature/route/UI-kit maps.

Also existing since Prompt 1: `docs/coding-guidelines/` (CODING-STANDARDS, NAMING-CONVENTIONS, GIT-STRATEGY) and `docs/architecture/ARCHITECTURE.md`.

## Hard rules

- Extend the established architecture — never redesign it. Mirror an existing module (backend: `modules/branches` simplest, `modules/authentication` fullest; frontend: `features/iam` newest).
- Permission keys are `resource:action` (colon). Every new tenant-scoped table needs a hand-written RLS migration. Every mutation endpoint needs `requirePermission` + an audit record.
- Verify like previous prompts: typecheck + eslint (zero warnings) + build + vitest (api) + LIVE smoke test via curl/Playwright against the running stack — static checks alone are not "done".
- **After finishing a prompt, update `docs/PROJECT-STATE.md` (prompt history, credentials) and the affected guide docs.** That's what keeps future sessions fast.
