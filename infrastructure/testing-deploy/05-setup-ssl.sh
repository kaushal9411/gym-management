#!/usr/bin/env bash
# Free Let's Encrypt certs (via Certbot) for the 3 named hosts (api./admin./
# fitcloud.<domain>) — fully automatic, HTTP-01 challenge, auto-renewing.
#
# NOT covered: the wildcard *.PLATFORM_HOSTNAME (tenant slugs, e.g.
# acme.fitcloud.appkraft.info). Wildcard certs require a DNS-01 challenge
# (proving control via a TXT record), which needs either a DNS provider API
# plugin or a manual TXT record per issuance/renewal — out of scope for a
# testing box. Tenant subdomains stay on plain HTTP; this is harmless (an
# HTTPS page calling an HTTP page isn't a thing here — the API itself gets a
# real cert and tenant-web calling it via https works fine regardless of
# which protocol tenant-web's own page loaded over).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# shellcheck source=config.env
source ./config.env
# shellcheck source=credentials.txt
source ./credentials.txt

if [ -z "${API_HOSTNAME:-}" ] || [ -z "${ADMIN_HOSTNAME:-}" ] || [ -z "${PLATFORM_HOSTNAME:-}" ]; then
  echo "Set API_HOSTNAME / ADMIN_HOSTNAME / PLATFORM_HOSTNAME in config.env first (run 04-setup-domain.sh first)." >&2
  exit 1
fi

export AWS_DEFAULT_REGION="$AWS_REGION"
SSH_KEY="./${KEY_NAME}.pem"
REMOTE="ubuntu@${PUBLIC_IP}"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new $REMOTE"

echo "Opening port 443 on the security group (idempotent)..."
aws ec2 authorize-security-group-ingress --group-id "$SECURITY_GROUP_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 >/dev/null 2>&1 \
  || echo "  (already open)"

echo "Requesting certs + reconfiguring nginx + switching apps to https..."
$SSH bash -s -- "$API_HOSTNAME" "$ADMIN_HOSTNAME" "$PLATFORM_HOSTNAME" <<'REMOTE_SCRIPT'
set -euo pipefail
API_HOSTNAME="$1"; ADMIN_HOSTNAME="$2"; PLATFORM_HOSTNAME="$3"
APP_ROOT="$HOME/gym-management"
export PATH="$PATH:$(npm config get prefix)/bin"

echo "-- splitting nginx's fitcloud block: bare host (gets a cert) vs wildcard (stays http-only) --"
sudo tee /etc/nginx/sites-available/fitcloud-test.conf > /dev/null <<NGINX
server {
    listen 80;
    server_name ${API_HOSTNAME};
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
    server_name ${PLATFORM_HOSTNAME};
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
server {
    # Wildcard tenant subdomains (e.g. acme.${PLATFORM_HOSTNAME}) — no
    # wildcard cert (would need DNS-01), stays plain HTTP.
    listen 80;
    server_name *.${PLATFORM_HOSTNAME};
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
sudo nginx -t
sudo systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  echo "-- installing certbot --"
  sudo apt-get update -y
  sudo apt-get install -y certbot python3-certbot-nginx
fi

echo "-- requesting certs for the 3 named hosts (HTTP-01, auto-renewing via certbot.timer) --"
sudo certbot --nginx \
  -d "$API_HOSTNAME" -d "$ADMIN_HOSTNAME" -d "$PLATFORM_HOSTNAME" \
  --non-interactive --agree-tos --redirect --register-unsafely-without-email

echo "-- switching apps to https:// for the 3 named hosts --"
sed -i "s#^API_PUBLIC_URL=.*#API_PUBLIC_URL=https://${API_HOSTNAME}#" "$APP_ROOT/apps/api/.env"
sed -i "s#^CORS_ORIGINS=.*#CORS_ORIGINS=https://${ADMIN_HOSTNAME},https://${PLATFORM_HOSTNAME},https://${API_HOSTNAME},http://${ADMIN_HOSTNAME},http://${PLATFORM_HOSTNAME},http://${API_HOSTNAME}#" "$APP_ROOT/apps/api/.env"

echo "NEXT_PUBLIC_PLATFORM_DOMAIN=${PLATFORM_HOSTNAME}
NEXT_PUBLIC_API_URL=https://${API_HOSTNAME}/api/v1" > "$APP_ROOT/apps/tenant-web/.env"
echo "NEXT_PUBLIC_API_URL=https://${API_HOSTNAME}/api/v1" > "$APP_ROOT/apps/super-admin/.env"

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
echo "== SSL done =="
echo "API:           https://${API_HOSTNAME}/api/v1  (docs: /api/docs)"
echo "Tenant portal: https://${PLATFORM_HOSTNAME}  (tenant slugs stay http:// — no wildcard cert, see script header)"
echo "Super Admin:   https://${ADMIN_HOSTNAME}"
echo "Certs auto-renew via certbot's systemd timer — nothing further needed for the 3 named hosts."
