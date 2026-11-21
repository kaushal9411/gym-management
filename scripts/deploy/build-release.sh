#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# Build a deployable release — NOT on the production box.
#
# The production server is a ~1GB t3.micro; building api + tenant-web +
# super-admin on it ran out of memory (and once took the live site down).
# This script does all the heavy work somewhere with real RAM (your
# machine, or the GitHub Actions runner) and produces ONE file,
# release/release.tgz, which `remote-finalize.sh` then unpacks on the server.
#
# Must run on Linux (the .next output and the packaged files are what the
# Linux server will run). On Windows/macOS use `scripts/deploy/deploy.sh`,
# which runs this inside a Linux container for you.
#
# Env (all optional):
#   ENV_DIR      directory holding tenant-web.env + super-admin.env — the
#                production values for NEXT_PUBLIC_* (these are baked into
#                the browser bundle at build time, so they must be the
#                PRODUCTION ones). deploy.sh / CI copy them from the server.
#   RELEASE_OUT  where to write release.tgz   (default: <repo>/release)
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
OUT="${RELEASE_OUT:-$ROOT/release}"
mkdir -p "$OUT"

if [ "$(uname -s)" != "Linux" ]; then
  echo "build-release.sh must run on Linux (got $(uname -s)). Use scripts/deploy/deploy.sh — it builds inside a Linux container." >&2
  exit 1
fi

if [ -n "${ENV_DIR:-}" ]; then
  for f in tenant-web super-admin; do
    [ -f "$ENV_DIR/$f.env" ] || { echo "Missing $ENV_DIR/$f.env" >&2; exit 1; }
  done
  cp "$ENV_DIR/tenant-web.env" apps/tenant-web/.env
  cp "$ENV_DIR/super-admin.env" apps/super-admin/.env
  echo "-- using production NEXT_PUBLIC_* from $ENV_DIR"
else
  echo "-- WARNING: no ENV_DIR — the web apps will be built with whatever apps/*/.env exist here (NOT production values)"
fi

# Plenty of headroom here; the server's 1536 limit is why this isn't built there.
export NODE_OPTIONS="--max-old-space-size=4096"
# Prisma's generate needs DATABASE_URL to be present (not reachable).
export DATABASE_URL="${DATABASE_URL:-postgresql://gym:gym@localhost:5432/gym_saas_build?schema=public}"
export TURBO_TELEMETRY_DISABLED=1

echo "-- pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "-- prisma generate"
pnpm --filter @gym-saas/api run prisma:generate

echo "-- building api"
pnpm --filter @gym-saas/api run build
echo "-- building tenant-web"
pnpm --filter @gym-saas/tenant-web run build
echo "-- building super-admin"
pnpm --filter @gym-saas/super-admin run build

# Everything the server needs that isn't already there: the compiled output,
# the files Next reads at runtime, the Prisma schema + migrations, and the
# manifests so the server can tell whether dependencies changed.
FILES=(
  apps/api/dist
  apps/api/prisma
  apps/api/package.json
  apps/tenant-web/.next
  apps/tenant-web/package.json
  apps/tenant-web/next.config.mjs
  apps/super-admin/.next
  apps/super-admin/package.json
  apps/super-admin/next.config.mjs
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  scripts/deploy/remote-finalize.sh
)
for f in packages/*/package.json; do FILES+=("$f"); done
[ -d apps/tenant-web/public ] && FILES+=(apps/tenant-web/public)
[ -d apps/super-admin/public ] && FILES+=(apps/super-admin/public)

echo "-- packaging release.tgz"
# .next/cache is a build cache (hundreds of MB) the server never reads.
tar --exclude='.next/cache' --exclude='node_modules' -czf "$OUT/release.tgz" "${FILES[@]}"

SHA="${RELEASE_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
echo "$SHA" > "$OUT/release.sha"
ls -lh "$OUT/release.tgz" | awk '{print "-- built release.tgz ("$5") from commit '"$SHA"'"}'
