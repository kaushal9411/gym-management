#!/usr/bin/env bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

cd "$(dirname "${BASH_SOURCE[0]}")/../apps/tenant-web"
pnpm dev
exec bash
