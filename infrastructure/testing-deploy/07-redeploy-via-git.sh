#!/usr/bin/env bash
# Sibling to 06-redeploy-code.sh, for the "Option B" workflow: the server's
# ~/gym-management is a real git repo (set up once — `git init` +
# `remote add origin` + `fetch`/`reset --hard origin/main`, since the repo
# there previously had no .git at all, rsync always excludes it), so this
# pulls the latest main directly on the server instead of rsync-ing a local
# checkout. Useful when deploying from a machine that doesn't have a local
# clone of this repo, just SSH access — this script only needs the SSH key,
# nothing else. Same tail as 06 otherwise (install/migrate/build/restart),
# domain/SSL config untouched.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"

echo "Pulling latest main directly on ${REMOTE}..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail
cd ~/gym-management
export PATH="$PATH:$(npm config get prefix)/bin"
export NODE_OPTIONS="--max-old-space-size=1536"

echo "-- git fetch + reset --hard origin/main --"
git fetch origin main
git reset --hard origin/main

# tenant-web/super-admin run as `next start`, which reads node_modules/
# .next live on every request — rebuilding in place underneath them while
# they're still serving traffic caused a real production incident (hundreds
# of pm2 crash-restarts, CPU/swap thrashing). `fitcloud-api` is a single
# pre-loaded compiled file (no live per-request disk reads), so it's never
# affected and stays up the whole time. Stopping these two up front covers
# `pnpm install` too, which rewrites the shared node_modules for every
# workspace package before any individual app build even starts.
echo "-- stopping tenant-web/super-admin for the install+build window --"
pm2 stop fitcloud-tenant-web fitcloud-super-admin

echo "-- pnpm install --"
pnpm install

echo "-- prisma generate + migrate deploy (no-op if nothing changed) --"
pnpm --filter @gym-saas/api run prisma:generate
pnpm --filter @gym-saas/api exec prisma migrate deploy

echo "-- building + restarting api --"
pnpm --filter @gym-saas/api run build
pm2 restart fitcloud-api

echo "-- building + starting tenant-web --"
pnpm --filter @gym-saas/tenant-web run build
pm2 start fitcloud-tenant-web

echo "-- building + starting super-admin --"
pnpm --filter @gym-saas/super-admin run build
pm2 start fitcloud-super-admin
pm2 save
REMOTE_SCRIPT

echo ""
echo "== Redeploy done (via git) — domain/SSL config untouched =="
