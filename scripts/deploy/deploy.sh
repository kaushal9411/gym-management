#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# One command: build locally, ship to the server.
#
#   pnpm deploy:server          (or: bash scripts/deploy/deploy.sh)
#
#   1. reads the PRODUCTION NEXT_PUBLIC_* values off the server's .env files
#      (they are baked into the browser bundle, so they must match prod)
#   2. builds api + tenant-web + super-admin on THIS machine — inside a Linux
#      container on Windows/macOS (needs Docker), natively on Linux
#   3. copies one release.tgz to the server
#   4. runs remote-finalize.sh there: swap build, migrate, restart pm2, health check
#
# The server never compiles anything. One-time setup: copy
# scripts/deploy/deploy.config.example to scripts/deploy/deploy.config and fill it.
#
# Flags:  --skip-build   re-ship the last release/release.tgz
#         --no-docker    force a native build (Linux only)
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
CONFIG="$ROOT/scripts/deploy/deploy.config"
[ -f "$CONFIG" ] || { echo "Missing $CONFIG — copy deploy.config.example and fill it in." >&2; exit 1; }
# shellcheck disable=SC1090
source "$CONFIG"
: "${DEPLOY_HOST:?set DEPLOY_HOST in deploy.config}"
: "${DEPLOY_USER:=ubuntu}"
: "${DEPLOY_KEY:?set DEPLOY_KEY in deploy.config}"
: "${HEALTH_URL:=}"
KEY="${DEPLOY_KEY/#\~/$HOME}"
[ -f "$KEY" ] || { echo "SSH key not found: $KEY" >&2; exit 1; }

SKIP_BUILD=0; FORCE_NATIVE=0
for a in "$@"; do
  case "$a" in
    --skip-build) SKIP_BUILD=1 ;;
    --no-docker) FORCE_NATIVE=1 ;;
    *) echo "unknown flag $a" >&2; exit 1 ;;
  esac
done

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
OUT="$ROOT/release"
mkdir -p "$OUT"

if [ -n "$(git status --porcelain)" ]; then
  echo "NOTE: you have uncommitted changes — they WILL be in this build. (Commit first if you want the deploy to match git.)"
fi
echo "== Deploying commit $(git rev-parse --short HEAD) ($(git log -1 --format=%s)) to $REMOTE"

if [ "$SKIP_BUILD" = 0 ]; then
  ENVDIR="$OUT/envs"
  mkdir -p "$ENVDIR"
  echo "-- reading production NEXT_PUBLIC_* from the server"
  ssh "${SSH_OPTS[@]}" "$REMOTE" 'cat ~/gym-management/apps/tenant-web/.env' > "$ENVDIR/tenant-web.env"
  ssh "${SSH_OPTS[@]}" "$REMOTE" 'cat ~/gym-management/apps/super-admin/.env' > "$ENVDIR/super-admin.env"
  grep -q NEXT_PUBLIC_API_URL "$ENVDIR/tenant-web.env" || { echo "tenant-web.env from the server has no NEXT_PUBLIC_API_URL — refusing to build" >&2; exit 1; }

  if [ "$(uname -s)" = "Linux" ] && [ "$FORCE_NATIVE" = 1 -o -z "${DEPLOY_USE_DOCKER:-}" ]; then
    echo "-- building natively"
    ENV_DIR="$ENVDIR" RELEASE_OUT="$OUT" bash scripts/deploy/build-release.sh
  else
    command -v docker >/dev/null || { echo "Docker is required to build on $(uname -s) (the server runs Linux)." >&2; exit 1; }
    echo "-- building inside a Linux container (first run is slow; pnpm store + Next cache are kept in Docker volumes, so later runs are much faster)"
    # Windows paths for Docker when running under Git Bash.
    if pwd -W >/dev/null 2>&1; then P() { (cd "$1" && pwd -W); }; else P() { (cd "$1" && pwd); }; fi
    MSYS_NO_PATHCONV=1 docker run --rm \
      -v "$(P "$ROOT"):/src:ro" -v "$(P "$OUT"):/out" -v "$(P "$ENVDIR"):/envs:ro" \
      -v fitcloud-pnpm-store:/root/.local/share/pnpm/store \
      -v fitcloud-next-cache-tenant:/work/apps/tenant-web/.next/cache \
      -v fitcloud-next-cache-admin:/work/apps/super-admin/.next/cache \
      -e CI=1 -e RELEASE_SHA="$(git rev-parse --short HEAD)" node:20-bookworm bash -c '
        set -euo pipefail
        corepack enable && corepack prepare pnpm@9.15.4 --activate
        mkdir -p /work && cd /src
        tar --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git --exclude=release --exclude=.turbo -cf - . | tar -xf - -C /work
        cd /work && ENV_DIR=/envs RELEASE_OUT=/out bash scripts/deploy/build-release.sh
      '
  fi
fi

[ -f "$OUT/release.tgz" ] || { echo "No release/release.tgz to ship." >&2; exit 1; }
echo "-- uploading $(du -h "$OUT/release.tgz" | cut -f1)"
scp "${SSH_OPTS[@]}" "$OUT/release.tgz" "$REMOTE:/tmp/fitcloud-release.tgz"
scp "${SSH_OPTS[@]}" scripts/deploy/remote-finalize.sh "$REMOTE:/tmp/fitcloud-finalize.sh"

echo "-- finalizing on the server (swap, migrate, restart)"
ssh "${SSH_OPTS[@]}" "$REMOTE" 'bash /tmp/fitcloud-finalize.sh /tmp/fitcloud-release.tgz && rm -f /tmp/fitcloud-release.tgz /tmp/fitcloud-finalize.sh'

if [ -n "$HEALTH_URL" ]; then
  echo "-- public health check: $HEALTH_URL"
  for _ in $(seq 1 20); do curl -sf "$HEALTH_URL" -o /dev/null && { echo "== Deployed and healthy."; exit 0; }; sleep 3; done
  echo "Server finished but $HEALTH_URL is not answering." >&2; exit 1
fi
echo "== Deployed."
