# XHCMS Novel 2.0 —— 停止 Docker Compose 服务
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
docker compose down
Write-Host 'Docker 服务已停止（数据卷 xhcms-data 保留）。' -ForegroundColor Green
