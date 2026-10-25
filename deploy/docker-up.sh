#!/usr/bin/env bash
# XHCMS Novel 2.0 —— Docker Compose 一键启动
# 用法：bash deploy/docker-up.sh [--rebuild] [--seed]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REBUILD=0
SEED=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild) REBUILD=1; shift ;;
    --seed) SEED=1; shift ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

command -v docker >/dev/null || { echo "未找到 docker，请安装 Docker Engine / Docker Desktop"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker 守护进程未运行，请先启动 Docker"; exit 1; }

echo "==> 准备 docker-compose 环境变量"
if [[ ! -f .env ]]; then
  cp deploy/docker-env.example .env
  for key in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET JWT_MEMBER_SECRET; do
    secret="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
    sed -i "s|^${key}=.*|${key}=${secret}|" .env
  done
  echo "  已生成 .env（含随机 JWT 密钥）"
else
  echo "  已存在 .env，直接使用"
fi
if [[ "$SEED" -eq 1 ]]; then
  # 只对本次 docker compose up 生效：不写回 .env，避免把「每次启动都清库重灌」永久化。
  # shell 环境变量优先级高于 .env 文件，因此这里 export 即可；入口脚本另有 /data/.seeded 兜底。
  export SEED_DEMO=1
  echo "  本次启动将写入演示数据（SEED_DEMO=1 仅本次生效，不写入 .env）"
fi
if grep -q '^SEED_DEMO=1' .env 2>/dev/null; then
  echo "  注意：.env 中 SEED_DEMO=1 属于持久化设置（每次启动都会尝试灌数据，入口脚本已用 /data/.seeded 防重复）；建议改为 0"
fi

echo "==> 构建并启动容器（API :4000 / Web :3000）"
if [[ "$REBUILD" -eq 1 ]]; then
  docker compose up -d --build
else
  docker compose up -d
fi

echo "==> 等待健康检查"
for _ in $(seq 1 60); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' xhcms 2>/dev/null || echo unknown)"
  [[ "$status" == "healthy" ]] && { echo "  healthy"; break; }
  sleep 3
done

echo ""
echo "XHCMS Novel 容器已启动："
echo "  门户: http://localhost:3000"
echo "  后台: http://localhost:3000/admin"
echo "  API:  http://localhost:4000/api/v1"
echo "日志: docker compose logs -f"
echo "停止: bash deploy/docker-down.sh"
