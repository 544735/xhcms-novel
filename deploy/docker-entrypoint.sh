#!/usr/bin/env bash
# XHCMS Novel 2.0 Docker 容器入口：
#   1) 初始化数据库（prisma db push）
#   2) 可选写入演示数据（SEED_DEMO=1）
#   3) 同时启动 API（4000）与 Web（3000）
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://xhcms:xhcms@db:5432/xhcms?schema=public}"
export UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
export API_PORT="${API_PORT:-4000}"
export WEB_PORT="${WEB_PORT:-3000}"

mkdir -p "$UPLOAD_DIR"

cd /app

echo "[entrypoint] 应用数据库迁移：$DATABASE_URL"
pnpm --filter @wmcms/api exec prisma migrate deploy --schema prisma/schema.prisma

if [ "${SEED_DEMO:-0}" = "1" ]; then
  # db:seed 是破坏性操作（先清空全部表），因此只允许在数据卷上首次执行一次。
  SEED_MARKER="/data/.seeded"
  if [ -f "$SEED_MARKER" ]; then
    echo "[entrypoint] 检测到初始化标记 $SEED_MARKER，跳过演示数据（保留现有数据）"
  else
    echo "[entrypoint] 写入演示数据（SEED_DEMO=1，仅首次执行）"
    pnpm --filter @wmcms/api db:seed
    touch "$SEED_MARKER"
    echo "[entrypoint] 已初始化标记 $SEED_MARKER，后续启动不再灌数据；如需重新初始化请手动删除该标记"
  fi
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
