#!/usr/bin/env bash
cd "$(dirname "${BASH_SOURCE[0]}")/.."
docker compose up -d
echo
echo "== postgres :5433  redis :6379  mailpit :8025  minio :9001 =="
docker compose logs -f
exec bash
