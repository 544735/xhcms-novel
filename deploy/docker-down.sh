#!/usr/bin/env bash
# XHCMS Novel 2.0 —— 停止 Docker Compose 服务
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose down
echo "Docker 服务已停止（数据卷 xhcms-data 保留）。"
