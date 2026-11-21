# Deployment

Production is **one EC2 box (t3.micro, ~1GB RAM)** running `api`, `tenant-web` and `super-admin` under pm2, behind nginx. That box is too small to compile the three apps — builds there ran out of memory (it once hung for 30 min and took the live site down). So **nothing is built on the server any more**: the build happens elsewhere and only the finished output is shipped.

```
build-release.sh  ──►  release/release.tgz  ──►  scp  ──►  remote-finalize.sh (on the server)
(runner or your PC)     compiled api, .next ×2,           swap build → prisma migrate deploy →
                        prisma schema+migrations          pm2 restart → health check
```

## Automatic (GitHub Actions)

Push to `main` → **CI** (lint, build, typecheck, tests) → on success **Deploy Production**:
1. reads the production `NEXT_PUBLIC_*` values from the server's `apps/*/.env` (they are baked into the browser bundle at build time, so they must be the production ones),
2. builds on the GitHub runner (7GB RAM) with `scripts/deploy/build-release.sh`,
3. `scp`s `release.tgz` + `remote-finalize.sh` to the server and runs it,
4. smoke-tests `https://api.appkraft.info/health` and emails the result.

A failed **build** now never touches production (nothing is shipped). Secrets used: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `SES_SMTP_*` (unchanged).

## Manual: build on your machine, push to the server

```bash
cp scripts/deploy/deploy.config.example scripts/deploy/deploy.config   # once; fill DEPLOY_HOST / DEPLOY_KEY
pnpm deploy:server
```

It reads the production `NEXT_PUBLIC_*` off the server, builds in a **Linux container** (Docker is required on Windows/macOS — the server runs Linux, and a Windows-built `.next` is not safe to ship), uploads one tarball, runs `remote-finalize.sh`, then checks `HEALTH_URL`. Flags: `--skip-build` (re-ship the last `release/release.tgz`), `--no-docker` (native build on Linux). Give Docker Desktop ≥ 4GB RAM or `next build` may be killed.

## On the server

`remote-finalize.sh` stops `fitcloud-tenant-web`/`fitcloud-super-admin` (they read `.next` live), replaces `apps/api/dist` and both `.next`, runs `pnpm install --frozen-lockfile` **only if the dependency set changed** (hash in `~/gym-management/.deploy-deps-hash`), then `prisma generate` + `prisma migrate deploy`, restarts pm2 and waits for `/health`.

**Rollback:** the last 3 tarballs are kept in `~/releases/`. `ssh` in and run `bash ~/gym-management/scripts/deploy/remote-finalize.sh ~/releases/release-<older>.tgz` (database migrations are forward-only — a rollback restores code, not schema).

## Notes
- `infrastructure/testing-deploy/07-redeploy-via-git.sh` (pull + build on the server) is the old path — don't use it on the 1GB box.
- Changing a `NEXT_PUBLIC_*` value (e.g. a domain) means editing `apps/<app>/.env` on the server **and** redeploying — the value is compiled into the bundle.
- The first run of this pipeline has not been exercised against the real server yet; watch the first deploy.
