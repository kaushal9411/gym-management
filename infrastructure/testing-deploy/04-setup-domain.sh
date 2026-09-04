#!/usr/bin/env bash
# Switches the deploy from the sslip.io address to a real domain: installs
# nginx as a hostname-based reverse proxy (api./admin./fitcloud.<domain> ->
# ports 4000/3002/3001, no more :PORT in URLs), points the apps' env vars
# at the new hostnames, rebuilds the two Next.js apps (NEXT_PUBLIC_* is
# baked in at build time), and restarts everything. Requires
# API_HOSTNAME/ADMIN_HOSTNAME/PLATFORM_HOSTNAME in config.env, and DNS A
# records (PLATFORM_HOSTNAME needs a wildcard too) already pointed at the
# Elastic IP in credentials.txt — this script doesn't touch DNS itself.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

if [ -z "${API_HOSTNAME:-}" ] || [ -z "${ADMIN_HOSTNAME:-}" ] || [ -z "${PLATFORM_HOSTNAME:-}" ]; then
  echo "Set API_HOSTNAME / ADMIN_HOSTNAME / PLATFORM_HOSTNAME in config.env first." >&2
  exit 1
fi

export AWS_DEFAULT_REGION="$AWS_REGION"
SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $REMOTE"

echo "Opening port 80 on the security group (idempotent)..."
aws ec2 authorize-security-group-ingress --group-id "$SECURITY_GROUP_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null 2>&1 \
  || echo "  (already open)"

echo "Quick DNS sanity check from this machine..."
for HOST in "$API_HOSTNAME" "$ADMIN_HOSTNAME" "$PLATFORM_HOSTNAME" "check.$PLATFORM_HOSTNAME"; do
  RESOLVED=$(getent hosts "$HOST" 2>/dev/null | awk '{print $1}' | head -1 || true)
  if [ "$RESOLVED" = "$PUBLIC_IP" ]; then
    echo "  $HOST -> $RESOLVED  OK"
  else
    echo "  $HOST -> ${RESOLVED:-<not resolving yet>}  (expected $PUBLIC_IP — DNS may still be propagating)"
  fi
done

echo "Configuring nginx + switching env vars on the server..."
$SSH bash -s -- "$API_HOSTNAME" "$ADMIN_HOSTNAME" "$PLATFORM_HOSTNAME" <<'REMOTE_SCRIPT'
set -euo pipefail
API_HOSTNAME="$1"; ADMIN_HOSTNAME="$2"; PLATFORM_HOSTNAME="$3"
APP_ROOT="$HOME/gym-management"
export PATH="$PATH:$(npm config get prefix)/bin"

if ! command -v nginx >/dev/null 2>&1; then
  echo "-- installing nginx --"
  sudo apt-get update -y
  sudo apt-get install -y nginx
fi

echo "-- writing nginx config --"
sudo tee /etc/nginx/sites-available/fitcloud-test.conf > /dev/null <<NGINX
server {
    listen 80;
    server_name ${API_HOSTNAME};
    # Matches the API's own multer limit (300MB) for large uploads (mobile
    # .apk releases via /admin/app-releases) — nginx's 1MB default silently
    # 413s anything bigger before it ever reaches the app.
    client_max_body_size 300M;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
server {
    listen 80;
    server_name ${ADMIN_HOSTNAME};
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    listen 80;
    server_name ${PLATFORM_HOSTNAME} *.${PLATFORM_HOSTNAME};
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/fitcloud-test.conf /etc/nginx/sites-enabled/fitcloud-test.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx || sudo systemctl restart nginx

echo "-- updating apps/api/.env --"
sed -i "s#^PLATFORM_DOMAIN=.*#PLATFORM_DOMAIN=${PLATFORM_HOSTNAME}#" "$APP_ROOT/apps/api/.env"
sed -i "s#^API_PUBLIC_URL=.*#API_PUBLIC_URL=http://${API_HOSTNAME}#" "$APP_ROOT/apps/api/.env"

echo "-- updating apps/tenant-web/.env + apps/super-admin/.env --"
echo "NEXT_PUBLIC_PLATFORM_DOMAIN=${PLATFORM_HOSTNAME}
NEXT_PUBLIC_API_URL=http://${API_HOSTNAME}/api/v1" > "$APP_ROOT/apps/tenant-web/.env"
echo "NEXT_PUBLIC_API_URL=http://${API_HOSTNAME}/api/v1" > "$APP_ROOT/apps/super-admin/.env"

echo "-- rebuilding tenant-web + super-admin (NEXT_PUBLIC_* is build-time) --"
export NODE_OPTIONS="--max-old-space-size=1536"
cd "$APP_ROOT"
pnpm --filter @gym-saas/tenant-web run build
pnpm --filter @gym-saas/super-admin run build

echo "-- restarting all 3 via pm2 --"
pm2 restart fitcloud-api fitcloud-tenant-web fitcloud-super-admin
pm2 save
REMOTE_SCRIPT

echo ""
echo "== Domain switch done =="
echo "API:           http://${API_HOSTNAME}/api/v1  (docs: /api/docs)"
echo "Tenant portal: http://${PLATFORM_HOSTNAME}  (and http://<slug>.${PLATFORM_HOSTNAME} per gym)"
echo "Super Admin:   http://${ADMIN_HOSTNAME}"
echo "(If any hostname showed 'not resolving yet' above, give DNS a few more minutes and retry — everything else is already done.)"
