#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# Runs ON THE SERVER. Takes a release.tgz built elsewhere (see
# build-release.sh), swaps it in, migrates the database, restarts pm2.
# No compiling happens here — that is the whole point (1GB box).
#
#   bash remote-finalize.sh /tmp/fitcloud-release.tgz
#
# Rolling back = running this again with an older tarball: the last few
# are kept in ~/releases.
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

TARBALL="${1:?usage: remote-finalize.sh <release.tgz>}"
APP="$HOME/gym-management"
KEEP=3

export PATH="$PATH:$(npm config get prefix)/bin"
cd "$APP"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$HOME/releases"
cp "$TARBALL" "$HOME/releases/release-$STAMP.tgz"

# tenant-web / super-admin read .next live from disk (`next start`), so they
# must be stopped while it is replaced. The API is a single preloaded file and
# only restarts at the end.
echo "-- stopping tenant-web + super-admin"
pm2 stop fitcloud-tenant-web fitcloud-super-admin || true

echo "-- unpacking release"
rm -rf apps/api/dist apps/tenant-web/.next apps/super-admin/.next
tar -xzf "$TARBALL" -C "$APP"

# Install only when the dependency set actually changed.
NEW_HASH="$(cat pnpm-lock.yaml package.json apps/*/package.json packages/*/package.json | sha256sum | cut -d' ' -f1)"
OLD_HASH="$(cat "$APP/.deploy-deps-hash" 2>/dev/null || true)"
if [ "$NEW_HASH" != "$OLD_HASH" ]; then
  echo "-- dependencies changed -> pnpm install"
  pnpm install --frozen-lockfile
  echo "$NEW_HASH" > "$APP/.deploy-deps-hash"
else
  echo "-- dependencies unchanged, skipping install"
fi

echo "-- prisma generate + migrate deploy"
pnpm --filter @gym-saas/api run prisma:generate
pnpm --filter @gym-saas/api exec prisma migrate deploy

echo "-- restarting"
pm2 restart fitcloud-api
pm2 start fitcloud-tenant-web fitcloud-super-admin
pm2 save

# Keep only the newest few tarballs.
ls -1t "$HOME"/releases/release-*.tgz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "-- waiting for the API to answer"
for _ in $(seq 1 30); do
  if curl -sf http://localhost:4000/health -o /dev/null; then
    echo "-- healthy"
    exit 0
  fi
  sleep 2
done
echo "API did not become healthy within 60s — check: pm2 logs fitcloud-api" >&2
exit 1
