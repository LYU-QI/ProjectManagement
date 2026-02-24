#!/usr/bin/env bash
  set -e

  ROOT="/Users/riqi/project/ProjectManagement"
  cd "$ROOT"

  echo "==> Start DB"
  docker compose up -d

  echo "==> Kill port 3000"
  lsof -ti:3000 | xargs -r kill || true

  echo "==> Start backend"
  nohup npm run -w backend dev > "$ROOT/backend-start.out.log" 2> "$ROOT/backend-start.err.log" &

  echo "==> Start frontend"
  nohup npm run -w frontend dev > "$ROOT/frontend-start.out.log" 2> "$ROOT/frontend-start.err.log" &

  echo "==> Done. Check logs:"
  echo "  backend: $ROOT/backend-start.out.log / $ROOT/backend-start.err.log"
  echo "  frontend: $ROOT/frontend-start.out.log / $ROOT/frontend-start.err.log"
