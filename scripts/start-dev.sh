#!/usr/bin/env bash
# Starts all gym-management dev servers (api, tenant-web, super-admin) plus their
# Docker backing services (postgres, redis, mailpit, minio) in a single terminal —
# output is interleaved with per-app prefixes via turbo, not split across tabs.
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

echo "== Freeing ports 3001, 3002, 4000 =="
for port in 3001 3002 4000; do
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Killing PID $pid on port $port"
    kill -9 $pid 2>/dev/null || true
  fi
done

cd "$REPO_ROOT"

echo "== Starting Docker backing services (postgres :5433, redis :6379, mailpit :8025, minio :9001) =="
docker compose up -d

echo "== Starting app dev servers — api :4000, tenant-web :3001, super-admin :3002 =="
pnpm dev
