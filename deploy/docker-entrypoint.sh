#!/usr/bin/env bash
# XHCMS Novel 2.0 Docker 容器入口：
#   1) 初始化数据库（prisma db push）
#   2) 可选写入演示数据（SEED_DEMO=1）
#   3) 同时启动 API（4000）与 Web（3000）
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
export API_PORT="${API_PORT:-4000}"
export WEB_PORT="${WEB_PORT:-3000}"

DATA_DIR="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$DATA_DIR")" "$UPLOAD_DIR"

cd /app

echo "[entrypoint] 同步数据库结构：$DATABASE_URL"
pnpm --filter @wmcms/api exec prisma db push --schema prisma/schema.prisma --skip-generate

if [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "[entrypoint] 写入演示数据（SEED_DEMO=1）"
  pnpm --filter @wmcms/api db:seed
fi

echo "[entrypoint] 启动 API :$API_PORT"
cd /app/apps/api
PORT="$API_PORT" node dist/main.js &
API_PID=$!

echo "[entrypoint] 等待 API 健康检查…"
HEALTHY=0
for _ in $(seq 1 90); do
  if node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    HEALTHY=1
    break
  fi
  sleep 1
done
if [ "$HEALTHY" != "1" ]; then
  echo "[entrypoint] API 未在 90 秒内就绪" >&2
  exit 1
fi

echo "[entrypoint] 启动 Web :$WEB_PORT"
cd /app/apps/web
PORT="$WEB_PORT" node node_modules/next/dist/bin/next start &
WEB_PID=$!

trap 'kill "$API_PID" "$WEB_PID" 2>/dev/null || true' TERM INT
wait -n "$API_PID" "$WEB_PID"
