#!/usr/bin/env bash
# XHCMS Novel 2.0 —— Linux / macOS 启动 / 重启脚本（依赖已安装时使用）
# 完整一键部署（含依赖安装、环境变量生成、数据库初始化、构建）请用：
#   bash deploy/deploy-linux.sh --seed
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/deploy-linux.sh" --skip-install "$@"
