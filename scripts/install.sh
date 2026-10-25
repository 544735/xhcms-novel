#!/usr/bin/env bash
# XHCMS Novel 2.0 —— 一键拉取并安装（Docker Compose + PostgreSQL）
# 用法：
#   bash install.sh                 # 默认克隆到 ./xhcms-novel
#   XHCMS_DIR=/opt/xhcms bash install.sh
#   XHCMS_REPO_URL=... XHCMS_BRANCH=main bash install.sh
set -euo pipefail

REPO_URL="${XHCMS_REPO_URL:-https://github.com/544735/xhcms-novel.git}"
BRANCH="${XHCMS_BRANCH:-main}"
TARGET_DIR="${XHCMS_DIR:-$PWD/xhcms-novel}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\033[1;31m错误：%s\033[0m\n' "$1" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "缺少依赖：$1（请先安装）"; }
say "检查环境"
need git; need docker; need node
docker info >/dev/null 2>&1 || die "Docker 守护进程未运行，请先启动 Docker"
docker compose version >/dev/null 2>&1 || die "需要 Docker Compose v2（docker compose）"

if [ -d "$TARGET_DIR/.git" ]; then
  say "更新已有仓库：$TARGET_DIR"
  git -C "$TARGET_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$TARGET_DIR" checkout "$BRANCH"
  git -C "$TARGET_DIR" pull --ff-only
else
  say "拉取仓库到 $TARGET_DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$TARGET_DIR"
fi

cd "$TARGET_DIR"
if [ ! -f .env ]; then
  say "生成 .env（随机密钥）"
  cp deploy/docker-env.example .env
fi

gen() { node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"; }
for key in POSTGRES_PASSWORD JWT_SECRET JWT_REFRESH_SECRET JWT_MEMBER_SECRET; do
  current="$(grep -E "^${key}=" .env 2>/dev/null | head -n1 | cut -d= -f2- || true)"
  if [ -z "${current}" ]; then
    sed -i.bak "s|^${key}=.*|${key}=$(gen)|" .env 2>/dev/null || printf '%s=%s\n' "$key" "$(gen)" >> .env
    rm -f .env.bak
  fi
done
# 首次安装默认写入演示数据（入口脚本用 /data/.seeded 保证只灌一次）
grep -q '^SEED_DEMO=' .env || printf 'SEED_DEMO=1\n' >> .env

say "构建并启动（首次构建可能需要几分钟）"
docker compose up -d --build

say "等待应用就绪"
ok=0
for _ in $(seq 1 80); do
  if node -e "fetch('http://127.0.0.1:${WEB_PORT:-3000}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    ok=1; break
  fi
  sleep 3
done
if [ "$ok" != "1" ]; then
  docker compose logs --tail 80 app || true
  die "应用未在预期时间内就绪，请查看上方日志"
fi

WEB_PORT="${WEB_PORT:-3000}"; API_PORT="${API_PORT:-4000}"
say "安装完成"
printf '门户：      http://localhost:%s\n' "$WEB_PORT"
printf '管理后台：  http://localhost:%s/admin\n' "$WEB_PORT"
printf 'API：       http://localhost:%s/api/v1\n' "$API_PORT"
printf '初始管理员：admin（口令见 docker compose exec xhcms cat /data/.seed-credentials.txt）\n'
printf '首次登录后请立即修改口令，并删除该凭据文件。\n'
