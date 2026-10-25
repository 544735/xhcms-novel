#!/usr/bin/env bash
# XHCMS Novel 2.0 —— 一键拉取安装 / 环境检测
# 用法：
#   curl -fsSL .../install.sh | bash                    # 安装（默认 ./xhcms-novel）
#   curl -fsSL .../install.sh | bash -s -- --check      # 仅检测环境
#   XHCMS_DIR=/opt/xhcms bash install.sh
set -euo pipefail

REPO_URL="${XHCMS_REPO_URL:-https://github.com/544735/xhcms-novel.git}"
BRANCH="${XHCMS_BRANCH:-main}"
TARGET_DIR="${XHCMS_DIR:-$PWD/xhcms-novel}"
CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok() { printf '  \033[1;32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$1"; }
bad() { printf '  \033[1;31m✗\033[0m %s\n' "$1"; }
die() { printf '\033[1;31m错误：%s\033[0m\n' "$1" >&2; exit 1; }

ver() { command -v "$1" >/dev/null 2>&1 && "$@" 2>/dev/null | head -n1 || true; }
port_busy() {
  node -e "const s=require('net').connect(${1},'127.0.0.1');s.on('connect',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1))" >/dev/null 2>&1
}

say '环境检测'
printf '  系统：%s %s\n' "$(uname -s 2>/dev/null || echo unknown)" "$(uname -m 2>/dev/null || echo unknown)"
printf '  Shell：%s\n' "${SHELL:-unknown}"

MISSING=0
for cmd in git node; do
  if command -v "$cmd" >/dev/null 2>&1; then ok "$cmd：$(ver "$cmd" --version)"; else bad "缺少 $cmd"; MISSING=1; fi
done
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 20 ] && ok "Node.js >= 20（当前 v$(node -p 'process.versions.node')）" || { bad "Node.js 版本过低（需 >= 20）"; MISSING=1; }
fi
if command -v docker >/dev/null 2>&1; then
  ok "Docker：$(ver docker --version)"
  if docker info >/dev/null 2>&1; then ok 'Docker 守护进程运行中'; else bad 'Docker 守护进程未运行'; MISSING=1; fi
  if docker compose version >/dev/null 2>&1; then ok "Docker Compose：$(ver docker compose version)"; else bad '缺少 Docker Compose v2'; MISSING=1; fi
else
  bad '缺少 docker（推荐使用 Docker 部署）'; MISSING=1
fi

for p in "${WEB_PORT:-3000}" "${API_PORT:-4000}"; do
  if port_busy "$p"; then warn "端口 $p 已被占用（可修改 WEB_PORT/API_PORT）"; else ok "端口 $p 可用"; fi
done

if [ -d "$TARGET_DIR/.git" ]; then ok "目标目录已存在仓库，将执行更新：$TARGET_DIR"; else ok "目标目录：$TARGET_DIR（将克隆）"; fi

if [ "$CHECK_ONLY" = "1" ]; then
  say '仅检测模式：未做任何修改'
  [ "$MISSING" = "0" ] && { echo '环境满足安装要求。'; exit 0; }
  die '环境不满足要求，请按上方提示修复后重试'
fi
[ "$MISSING" = "0" ] || die '环境不满足要求，请先修复后再安装'

say '拉取仓库'
if [ -d "$TARGET_DIR/.git" ]; then
  git -C "$TARGET_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$TARGET_DIR" checkout "$BRANCH"
  git -C "$TARGET_DIR" pull --ff-only
else
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$TARGET_DIR"
fi
cd "$TARGET_DIR"

if [ ! -f .env ]; then
  say '生成 .env（随机密钥）'
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
grep -q '^SEED_DEMO=' .env || printf 'SEED_DEMO=1\n' >> .env

say '构建并启动（首次构建可能需要几分钟）'
docker compose up -d --build

say '等待应用就绪'
ok_app=0
for _ in $(seq 1 80); do
  if node -e "fetch('http://127.0.0.1:${WEB_PORT:-3000}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then ok_app=1; break; fi
  sleep 3
done
if [ "$ok_app" != "1" ]; then docker compose logs --tail 80 app || true; die '应用未在预期时间内就绪'; fi

say '安装完成'
printf '门户：      http://localhost:%s\n' "${WEB_PORT:-3000}"
printf '管理后台：  http://localhost:%s/admin\n' "${WEB_PORT:-3000}"
printf 'API：       http://localhost:%s/api/v1\n' "${API_PORT:-4000}"
printf '初始管理员：admin（口令：docker compose exec xhcms cat /data/.seed-credentials.txt）\n'
printf '首次登录后请立即改密并删除该文件。\n'
