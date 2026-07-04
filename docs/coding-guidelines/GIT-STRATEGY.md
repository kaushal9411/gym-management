# Git Branch Strategy

## Branches

| Branch | Purpose | Deploys to | Protected |
|---|---|---|---|
| `main` | Production. Always releasable; every merge is a release candidate. | production (gated) | ✅ 2 approvals, signed commits, no force-push |
| `develop` | Integration branch. Everything lands here first. | staging (auto) | ✅ 1 approval, no force-push |
| `feature/*` | New functionality, branched from `develop` | preview (optional) | — |
| `bugfix/*` | Non-urgent fixes, branched from `develop` | — | — |
| `release/*` | Release stabilization, branched from `develop` → merged to `main` **and back** to `develop`, tagged `vX.Y.Z` | staging (release candidate) | — |
| `hotfix/*` | Urgent production fixes, branched from `main` → merged to `main` **and back** to `develop` | production (expedited) | — |

## Flow

```
feature/FIT-123-x ──► develop ──► release/1.4.0 ──► main (tag v1.4.0)
                         ▲              │             │
                         └──────back────┘             │
hotfix/FIT-501-y ─────────────────────────────────────┤
      ▲                                               │
      └──────────── branched from main ◄──────────────┘
      └──► main (tag v1.4.1) + back-merge to develop
```

## Rules

1. Branch names: `<type>/<ticket>-<kebab-description>` (see NAMING-CONVENTIONS.md).
2. Branches live < 3 days where possible; big features split behind feature flags.
3. Conventional Commits enforced by commitlint; semantic-release derives versions/changelogs from them.
4. Squash merge only — one commit per PR on `develop`/`main`, linear history.
5. `release/*` accepts **fixes only** — no new features once cut.
6. Every `hotfix/*` and `release/*` merge to `main` is tagged and back-merged to `develop` immediately (CI reminds; humans do it).
7. Rollback = redeploy previous image tag, never `git revert` under pressure; revert PRs follow calmly afterwards.
