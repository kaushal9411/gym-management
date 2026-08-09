#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

cd "$(dirname "${BASH_SOURCE[0]}")/../apps/api"
echo "Waiting for postgres :5433..."
until pg_isready -h localhost -p 5433 -U gym >/dev/null 2>&1; do sleep 1; done
pnpm dev
exec bash
