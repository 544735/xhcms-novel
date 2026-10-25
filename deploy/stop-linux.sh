#!/usr/bin/env bash
# XHCMS Novel 2.0 —— Linux / macOS 停止服务脚本
# 用法：bash deploy/stop-linux.sh [--api-port 4000] [--web-port 3000]
set -uo pipefail
API_PORT=4000
WEB_PORT=3000
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-port) API_PORT="$2"; shift 2 ;;
    --web-port) WEB_PORT="$2"; shift 2 ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOG_DIR="$ROOT/logs"

stop_port() {
  local port="$1" label="$2"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  fi
  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "$port" 2>/dev/null || true)"
  fi
  if [[ -z "$pids" ]]; then
    echo "  $label（端口 $port）未在运行"
    return
  fi
  echo "  停止 $label（端口 $port，PID：$pids）"
  kill -9 $pids >/dev/null 2>&1 || true
}

echo "==> 停止 XHCMS Novel 服务"
stop_port "$API_PORT" "API"
stop_port "$WEB_PORT" "Web"
for name in api web; do
  [[ -f "$LOG_DIR/$name.pid" ]] && rm -f "$LOG_DIR/$name.pid"
done
echo "完成。"
