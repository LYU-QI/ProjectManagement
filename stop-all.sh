#!/usr/bin/env bash
set -e

ROOT="/Users/riqi/project/ProjectManagement"
cd "$ROOT"

echo "==> Kill backend (port 3000)"
lsof -ti:3000 | xargs kill 2>/dev/null || true

echo "==> Kill frontend (port 5173)"
lsof -ti:5173 | xargs kill 2>/dev/null || true

echo "==> Stop containers"
docker compose stop

echo "==> Done."
