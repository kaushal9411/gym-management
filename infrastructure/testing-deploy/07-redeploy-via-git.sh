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

echo "-- pnpm install --"
pnpm install

echo "-- prisma generate + migrate deploy (no-op if nothing changed) --"
pnpm --filter @gym-saas/api run prisma:generate
pnpm --filter @gym-saas/api exec prisma migrate deploy

echo "-- building api/tenant-web/super-admin --"
pnpm --filter @gym-saas/api run build
pnpm --filter @gym-saas/tenant-web run build
pnpm --filter @gym-saas/super-admin run build

echo "-- restarting via pm2 --"
pm2 restart fitcloud-api fitcloud-tenant-web fitcloud-super-admin
pm2 save
REMOTE_SCRIPT

echo ""
echo "== Redeploy done (via git) — domain/SSL config untouched =="
