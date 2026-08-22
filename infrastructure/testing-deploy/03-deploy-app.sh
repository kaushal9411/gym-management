#!/usr/bin/env bash
# Syncs the repo to the EC2 instance from 02-launch-ec2.sh and brings the
# whole stack up there: Postgres/Redis/Mailpit in Docker, the three Node
# apps run directly (built + managed by pm2, not containerized — see
# README.md for why). Re-run this any time you want to push local changes;
# it's idempotent (keeps the same DB/JWT secrets across re-deploys).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd ../.. && pwd)"

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $REMOTE"

echo "Waiting for cloud-init (Docker/Node/pnpm install) to finish on the instance..."
until $SSH 'test -f ~/cloud-init-done' 2>/dev/null; do sleep 5; done
echo "Cloud-init done."

echo "Syncing repo to ${REMOTE}:~/gym-management ..."
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude .next \
  --exclude 'apps/api/uploads' --exclude '.turbo' \
  --exclude '.env' --exclude '.env.local' --exclude '.env.*.local' \
  --exclude '.env.development' --exclude '.env.production' --exclude '.env.test' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
  "$REPO_ROOT/" "$REMOTE:~/gym-management/"

echo "Running remote setup (this can take several minutes — installs deps, builds 3 apps)..."
$SSH bash -s -- "$PUBLIC_IP" "$PLATFORM_DOMAIN" "$S3_REGION" "$S3_BUCKET" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" <<'REMOTE_SCRIPT'
set -euo pipefail
PUBLIC_IP="$1"; PLATFORM_DOMAIN="$2"; S3_REGION="$3"; S3_BUCKET="$4"; S3_ACCESS_KEY_ID="$5"; S3_SECRET_ACCESS_KEY="$6"

cd ~/gym-management
export PATH="$PATH:$(npm config get prefix)/bin"
# t3.micro has 1GB physical RAM — V8's default heap-size heuristic is based
# on physical RAM only (ignores the swap file added above), so tsc/webpack
# builds OOM well before the 2GB swap is actually exhausted. Raise the cap
# explicitly so builds can spill into swap (slower, but this is a one-time
# build step, not the running app).
export NODE_OPTIONS="--max-old-space-size=1536"

echo "-- pnpm install --"
pnpm install

echo "-- backing services (Postgres/Redis/Mailpit) --"
docker compose up -d

echo "-- waiting for Postgres --"
until docker exec gym-saas-postgres pg_isready -U gym -d gym_saas >/dev/null 2>&1; do sleep 2; done

if [ ! -f apps/api/.env ]; then
  echo "-- generating apps/api/.env (fresh secrets — first deploy) --"
  {
    echo "NODE_ENV=development"
    echo "PORT=4000"
    echo "API_VERSION=v1"
    echo "DATABASE_URL=postgresql://gym:gym@localhost:5433/gym_saas?schema=public"
    echo "REDIS_URL=redis://localhost:6379"
    node infrastructure/testing-deploy/gen-secrets.js
    echo "JWT_ACCESS_TTL=15m"
    echo "JWT_REFRESH_TTL_DAYS=30"
    echo "JWT_ISSUER=fitcloud"
    echo "JWT_AUDIENCE=fitcloud-tenant-app"
    echo "PLATFORM_DOMAIN=$PLATFORM_DOMAIN"
    echo "CORS_ORIGINS="
    echo "SMTP_HOST=localhost"
    echo "SMTP_PORT=1025"
    echo "MAIL_FROM_NAME=FitCloud"
    echo "MAIL_FROM_ADDRESS=no-reply@fitcloud.local"
    echo "LOG_LEVEL=info"
    echo "S3_REGION=$S3_REGION"
    echo "S3_BUCKET=$S3_BUCKET"
    echo "S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID"
    echo "S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY"
    echo "API_PUBLIC_URL=http://$PLATFORM_DOMAIN:4000"
  } > apps/api/.env
else
  echo "-- apps/api/.env already exists — leaving secrets as-is, re-deploy keeps sessions valid --"
fi

echo "NEXT_PUBLIC_PLATFORM_DOMAIN=$PLATFORM_DOMAIN
NEXT_PUBLIC_API_URL=http://$PLATFORM_DOMAIN:4000/api/v1" > apps/tenant-web/.env

echo "NEXT_PUBLIC_API_URL=http://$PLATFORM_DOMAIN:4000/api/v1" > apps/super-admin/.env

echo "-- prisma generate + migrate deploy + seed --"
pnpm --filter @gym-saas/api run prisma:generate
pnpm --filter @gym-saas/api exec prisma migrate deploy
pnpm --filter @gym-saas/api run prisma:seed

echo "-- building api/tenant-web/super-admin --"
pnpm --filter @gym-saas/api run build
pnpm --filter @gym-saas/tenant-web run build
pnpm --filter @gym-saas/super-admin run build

echo "-- (re)starting via pm2 --"
APP_ROOT="$HOME/gym-management"
pm2 delete fitcloud-api fitcloud-tenant-web fitcloud-super-admin >/dev/null 2>&1 || true
pm2 start "$APP_ROOT/apps/api/dist/server.js" --name fitcloud-api --cwd "$APP_ROOT/apps/api"
pm2 start pnpm --name fitcloud-tenant-web --cwd "$APP_ROOT/apps/tenant-web" -- start
pm2 start pnpm --name fitcloud-super-admin --cwd "$APP_ROOT/apps/super-admin" -- start
pm2 save
REMOTE_SCRIPT

echo ""
echo "== Deployed =="
echo "API:          http://${PLATFORM_DOMAIN}:4000/api/v1  (docs: /api/docs)"
echo "Tenant portal: http://<slug>.${PLATFORM_DOMAIN}:3001  (e.g. http://acme.${PLATFORM_DOMAIN}:3001 after onboarding)"
echo "Super Admin:  http://${PLATFORM_DOMAIN}:3002"
echo "SSH:          ssh -i ./${KEY_NAME}.pem ubuntu@${PUBLIC_IP}   (pm2 logs / pm2 status once inside)"
