#!/usr/bin/env bash
# Pushes local code changes to the server WITHOUT touching domain/SSL
# config: syncs the repo (still excluding .env* — the server's real
# api.appkraft.info/https config stays as-is), re-runs prisma
# generate/migrate (safe, idempotent — no-ops if nothing changed), rebuilds
# all 3 apps, restarts via pm2. Use this for every ordinary code change
# after the initial 03/04/05 setup — NOT 03-deploy-app.sh (which resets
# tenant-web/super-admin back to the sslip.io domain) or 04-setup-domain.sh
# (which rewrites nginx and would undo certbot's SSL edits from
# 05-setup-ssl.sh).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"
REPO_ROOT="$(cd ../.. && pwd)"

echo "Syncing repo to ${REMOTE}:~/gym-management ..."
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude .next \
  --exclude 'apps/api/uploads' --exclude '.turbo' \
  --exclude '.env' --exclude '.env.local' --exclude '.env.*.local' \
  --exclude '.env.development' --exclude '.env.production' --exclude '.env.test' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
  "$REPO_ROOT/" "$REMOTE:~/gym-management/"

echo "Rebuilding + restarting on the server (env/nginx untouched)..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$REMOTE" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail
cd ~/gym-management
export PATH="$PATH:$(npm config get prefix)/bin"
export NODE_OPTIONS="--max-old-space-size=1536"

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
echo "== Redeploy done — domain/SSL config untouched =="
