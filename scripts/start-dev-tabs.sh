#!/usr/bin/env bash
# Frees the app ports, then opens ONE gnome-terminal window with 4 tabs:
# Docker backing services, api, tenant-web, super-admin.
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS="$REPO_ROOT/scripts"

echo "== Freeing ports 3001, 3002, 4000 =="
for port in 3001 3002 4000; do
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Killing PID $pid on port $port"
    kill -9 $pid 2>/dev/null || true
  fi
done

gnome-terminal \
  --tab --title="Docker Services" --command="bash '$SCRIPTS/tab-docker.sh'" \
  --tab --title="API :4000" --command="bash '$SCRIPTS/tab-api.sh'" \
  --tab --title="Tenant Web :3001" --command="bash '$SCRIPTS/tab-tenant-web.sh'" \
  --tab --title="Super Admin :3002" --command="bash '$SCRIPTS/tab-super-admin.sh'"
