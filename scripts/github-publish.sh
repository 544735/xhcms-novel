#!/usr/bin/env bash
# XHCMS Novel 2.0 —— 一键发布到 GitHub（Linux / macOS）
#
# 前置：
#   1) 已安装 git
#   2) export GITHUB_TOKEN=ghp_xxx     # 需要 repo 写权限
#
# 用法：
#   bash scripts/github-publish.sh <owner/repo> [--private] [--skip-create]
set -euo pipefail

REPO=""
PRIVATE="false"
SKIP_CREATE=0
BRANCH="main"
MESSAGE="chore: initial commit — XHCMS Novel 2.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --private) PRIVATE="true"; shift ;;
    --skip-create) SKIP_CREATE=1; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;;
    -*) echo "未知参数：$1"; exit 1 ;;
    *) REPO="$1"; shift ;;
  esac
done

[[ -n "$REPO" ]] || { echo "用法：bash scripts/github-publish.sh <owner/repo> [--private] [--skip-create]"; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { echo ""; echo "==> $*"; }

step "检查 Git"
command -v git >/dev/null || { echo "未找到 git，请先安装 Git"; exit 1; }
echo "  $(git --version)"

OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
[[ "$OWNER" != "$REPO" ]] || { echo "仓库需为 owner/name 形式，例如 yourname/xhcms-novel"; exit 1; }
FULL="$OWNER/$NAME"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
echo "  目标仓库：$FULL（分支 $BRANCH）"

step "创建 GitHub 仓库（如不存在）"
if [[ "$SKIP_CREATE" -eq 0 ]]; then
  [[ -n "$TOKEN" ]] || { echo "自动创建仓库需要 GITHUB_TOKEN；如仓库已存在请加 --skip-create"; exit 1; }
  EXISTS=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$FULL")
  if [[ "$EXISTS" == "200" ]]; then
    echo "  仓库已存在，跳过创建"
  else
    LOGIN=$(curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
      https://api.github.com/user | sed -n 's/.*"login": *"\([^"]*\)".*/\1/p' | head -n1)
    if [[ "$LOGIN" == "$OWNER" ]]; then
      ENDPOINT="https://api.github.com/user/repos"
    else
      ENDPOINT="https://api.github.com/orgs/$OWNER/repos"
    fi
    curl -fsS -X POST "$ENDPOINT" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$NAME\",\"private\":$PRIVATE,\"description\":\"XHCMS Novel 2.0 — 现代化小说网站\",\"auto_init\":false}" >/dev/null
    echo "  已创建仓库：https://github.com/$FULL"
  fi
else
  echo "  已跳过仓库创建"
fi

step "初始化本地仓库并提交"
if [[ ! -d .git ]]; then
  git init >/dev/null
  git checkout -b "$BRANCH" 2>/dev/null || git branch -M "$BRANCH"
  echo "  已初始化仓库（分支 $BRANCH）"
fi
if [[ -z "$(git config user.name || true)" || -z "$(git config user.email || true)" ]]; then
  git config user.name "XHCMS"
  git config user.email "xhcms@users.noreply.github.com"
  echo "  已设置本仓库提交身份"
fi
git add -A
if [[ -n "$(git status --porcelain)" ]]; then
  git commit -m "$MESSAGE" >/dev/null
  echo "  已创建提交"
else
  echo "  工作区无变更，跳过提交"
fi

step "配置远端并推送"
REMOTE_URL="https://github.com/$FULL.git"
if git remote | grep -qx origin; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

if [[ -n "$TOKEN" ]]; then
  git -c credential.helper= push "https://x-access-token:$TOKEN@github.com/$FULL.git" "HEAD:refs/heads/$BRANCH"
  git remote set-url origin "$REMOTE_URL"
  git fetch origin "$BRANCH" >/dev/null
  git branch --set-upstream-to "origin/$BRANCH" >/dev/null
  echo "✅ 已推送（Token 未写入本地凭据）"
else
  git push -u origin "$BRANCH"
  echo "✅ 已推送"
fi

cat <<EOF

仓库地址：https://github.com/$FULL
后续更新：git add -A && git commit -m "feat: ..." && git push
发布版本：git tag v2.0.0 && git push origin v2.0.0   # 触发 Release / Docker 工作流
EOF
