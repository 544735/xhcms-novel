#!/usr/bin/env bash
# ============================================================================
# XHCMS Novel 2.0 —— Linux / macOS 一键部署脚本
#
# 功能：环境检查 → 生成/补全环境变量与随机密钥 → 安装依赖 → 初始化数据库
#       →（可选）演示数据 → 构建 → 停止旧进程 → 后台启动 → 健康检查
#
# 用法：
#   bash deploy/deploy-linux.sh                 # 一键部署
#   bash deploy/deploy-linux.sh --seed          # 附带演示数据（会清空数据库）
#   bash deploy/deploy-linux.sh --skip-install  # 依赖已安装
#   bash deploy/deploy-linux.sh --no-build      # 只重启
#   bash deploy/deploy-linux.sh --public-url https://demo.example.com
#   bash deploy/deploy-linux.sh --systemd       # 生成 systemd 服务并启动（需 sudo）
# ============================================================================
set -euo pipefail

API_PORT=4000
WEB_PORT=3000
PUBLIC_URL=""
SEED=0
SKIP_INSTALL=0
NO_BUILD=0
NO_START=0
USE_SYSTEMD=0
TIMEOUT_SEC=120

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-port) API_PORT="$2"; shift 2 ;;
    --web-port) WEB_PORT="$2"; shift 2 ;;
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --seed) SEED=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --no-build) NO_BUILD=1; shift ;;
    --no-start) NO_START=1; shift ;;
    --systemd) USE_SYSTEMD=1; shift ;;
    --timeout) TIMEOUT_SEC="$2"; shift 2 ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "未知参数：$1（--help 查看用法）"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"
DEPLOY_LOG="$LOG_DIR/deploy-$TIMESTAMP.log"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$DEPLOY_LOG"; }
step() { echo "" | tee -a "$DEPLOY_LOG"; echo "==> $*" | tee -a "$DEPLOY_LOG"; }
die() { log "ERROR: $*"; exit 1; }

gen_secret() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"; }

env_get() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  sed -n "s/^${key}=//p" "$file" | head -n1 | tr -d '"'
}

set_env() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" "$file"
  else
    printf '%s="%s"\n' "$key" "$value" >> "$file"
  fi
}

stop_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    [[ -n "$pids" ]] && kill -9 $pids >/dev/null 2>&1 || true
  else
    log "WARN: 未找到 fuser/lsof，无法按端口停止旧进程（可手动处理）"
  fi
}

wait_http() {
  local url="$1" deadline=$((SECONDS + TIMEOUT_SEC))
  while [[ $SECONDS -lt $deadline ]]; do
    if curl -fsS -o /dev/null --max-time 10 "$url"; then return 0; fi
    sleep 2
  done
  return 1
}

log "XHCMS Novel 一键部署开始（日志：$DEPLOY_LOG）"

step "1/8 检查运行环境"
command -v node >/dev/null || die "未找到 Node.js（需 >= 20）"
command -v pnpm >/dev/null || die "未找到 pnpm（corepack enable 或 npm i -g pnpm）"
command -v curl >/dev/null || die "未找到 curl（健康检查需要）"
NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)"
[[ "$NODE_MAJOR" -ge 20 ]] || die "Node.js 版本过低（$NODE_VERSION），需要 >= 20"
log "$NODE_VERSION / pnpm $(pnpm --version)"

[[ -n "$PUBLIC_URL" ]] || PUBLIC_URL="http://localhost:$WEB_PORT"
PUBLIC_URL="${PUBLIC_URL%/}"
log "对外地址：$PUBLIC_URL ｜ API 端口：$API_PORT ｜ Web 端口：$WEB_PORT"

step "2/8 生成 / 校验环境变量"
API_ENV="$ROOT/apps/api/.env"
WEB_ENV="$ROOT/apps/web/.env.local"
if [[ ! -f "$API_ENV" ]]; then
  # 密钥在部署时随机生成并写入 .env；源码中不存在任何固定密钥。
  {
    printf '# XHCMS Novel 2.0 API 环境变量（由 deploy-linux.sh 于 %s 生成）\n' "$TIMESTAMP"
    printf 'DATABASE_URL="postgresql://xhcms:xhcms@127.0.0.1:5432/xhcms?schema=public"\n'
    printf 'PORT=%s\n' "$API_PORT"
    printf 'NODE_ENV=production\n'
    printf 'JWT_SECRET=%s\n' "\"$(gen_secret)\""
    printf 'JWT_REFRESH_SECRET=%s\n' "\"$(gen_secret)\""
    printf 'JWT_MEMBER_SECRET=%s\n' "\"$(gen_secret)\""
    printf 'CORS_ORIGINS=%s\n' "\"$PUBLIC_URL\""
    printf 'UPLOAD_DIR="uploads"\n'
    printf 'PUBLIC_BASE_URL=%s\n' "\"$PUBLIC_URL\""
  } > "$API_ENV"
  log "已生成 apps/api/.env（含随机 JWT 密钥、生产模式）"
else
  ENV_PORT="$(env_get "$API_ENV" PORT)"
  if [[ -n "$ENV_PORT" && "$ENV_PORT" != "$API_PORT" ]]; then
    log "WARN: .env 中 PORT=$ENV_PORT 与 --api-port=$API_PORT 不一致，以 .env 为准"
    API_PORT="$ENV_PORT"
  fi
  for key in JWT_SECRET JWT_REFRESH_SECRET JWT_MEMBER_SECRET; do
    if [[ -z "$(env_get "$API_ENV" "$key")" ]]; then
      set_env "$API_ENV" "$key" "$(gen_secret)"
      log "已在 .env 中补全随机密钥：$key"
    fi
  done
  log "已校验 apps/api/.env（存在即保留，仅补全缺失密钥）"
fi

if [[ ! -f "$WEB_ENV" ]]; then
  HOST_PART="$(echo "$PUBLIC_URL" | sed -E 's#^https?://([^/:]+).*#\1#')"
  if [[ "$HOST_PART" == "localhost" || "$HOST_PART" == "127.0.0.1" || "$HOST_PART" == "::1" ]]; then
    PUBLIC_API="http://localhost:$API_PORT/api/v1"
  else
    PUBLIC_API="$PUBLIC_URL/api/v1"
  fi
  cat > "$WEB_ENV" <<EOF
NEXT_PUBLIC_API_URL="$PUBLIC_API"
API_INTERNAL_URL="http://127.0.0.1:$API_PORT/api/v1"
NEXT_PUBLIC_DEFAULT_SITE="books"
NEXT_PUBLIC_SITE_URL="$PUBLIC_URL"
NEXT_PUBLIC_SITE_HOSTS=""
EOF
  log "已生成 apps/web/.env.local（API：$PUBLIC_API）"
else
  log "已检测到 apps/web/.env.local（存在即保留）"
fi

step "3/8 停止旧服务进程"
stop_port "$API_PORT"
stop_port "$WEB_PORT"
if [[ -f "$LOG_DIR/api.pid" ]]; then kill "$(cat "$LOG_DIR/api.pid")" >/dev/null 2>&1 || true; rm -f "$LOG_DIR/api.pid"; fi
if [[ -f "$LOG_DIR/web.pid" ]]; then kill "$(cat "$LOG_DIR/web.pid")" >/dev/null 2>&1 || true; rm -f "$LOG_DIR/web.pid"; fi
log "旧进程已停止"

step "4/8 安装依赖"
if [[ "$SKIP_INSTALL" -eq 1 ]]; then
  log "已跳过依赖安装（--skip-install）"
else
  pnpm install --reporter=append-only
fi

step "5/8 初始化数据库"
pnpm --filter @wmcms/api db:push

step "6/8 构建"
if [[ "$NO_BUILD" -eq 1 ]]; then
  log "已跳过构建（--no-build）"
else
  pnpm build
fi

if [[ "$SEED" -eq 1 ]]; then
  step "7/8 写入演示数据（会清空数据库）"
  pnpm --filter @wmcms/api db:seed
else
  step "7/8 跳过演示数据（如需初始化演示数据请加 --seed）"
fi

step "8/8 启动服务与健康检查"
if [[ "$NO_START" -eq 1 ]]; then
  log "已跳过启动（--no-start）"
elif [[ "$USE_SYSTEMD" -eq 1 ]]; then
  command -v systemctl >/dev/null || die "当前系统无 systemd"
  log "生成 systemd 服务（需要 sudo）"
  sudo tee /etc/systemd/system/xhcms-api.service > /dev/null <<EOF
[Unit]
Description=XHCMS Novel API
After=network.target
[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=/usr/bin/env pnpm --filter @wmcms/api start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF
  sudo tee /etc/systemd/system/xhcms-web.service > /dev/null <<EOF
[Unit]
Description=XHCMS Novel Web
After=network.target xhcms-api.service
[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=/usr/bin/env pnpm --filter @wmcms/web start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now xhcms-api xhcms-web
  log "systemd 服务已启动（xhcms-api / xhcms-web）"
else
  nohup pnpm --filter @wmcms/api start > "$LOG_DIR/api.log" 2>&1 &
  echo $! > "$LOG_DIR/api.pid"
  log "API 启动中…"
  wait_http "http://127.0.0.1:$API_PORT/api/v1/health" || { tail -n 40 "$LOG_DIR/api.log" || true; die "API 健康检查未通过"; }
  nohup pnpm --filter @wmcms/web start > "$LOG_DIR/web.log" 2>&1 &
  echo $! > "$LOG_DIR/web.pid"
  log "Web 启动中…"
  wait_http "http://127.0.0.1:$WEB_PORT/" || { tail -n 40 "$LOG_DIR/web.log" || true; die "Web 健康检查未通过"; }
  log "健康检查通过：API /health 200，门户首页 200"
fi

cat <<EOF

============================================================
  XHCMS Novel 2.0 部署完成
============================================================
  门户首页:  $PUBLIC_URL
  管理后台:  $PUBLIC_URL/admin
  API:       http://localhost:$API_PORT/api/v1
  API 文档:  http://localhost:$API_PORT/api/docs

  管理员账号:  admin（口令见 apps/api/.seed-credentials.txt 或 SEED_ADMIN_PASSWORD）
  服务日志:  logs/api.log  /  logs/web.log
  部署日志:  $DEPLOY_LOG
  停止服务:  bash deploy/stop-linux.sh
EOF
