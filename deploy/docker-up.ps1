# XHCMS Novel 2.0 —— Docker Compose 一键启动
# 用法：
#   powershell -ExecutionPolicy Bypass -File deploy\docker-up.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\docker-up.ps1 -Rebuild -Seed
[CmdletBinding()]
param(
    [switch]$Rebuild,
    [switch]$Seed,
    [int]$TimeoutSec = 180
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step([string]$text) { Write-Host "==> $text" -ForegroundColor Cyan }
function New-Secret { (& node -e "console.log(require('crypto').randomBytes(48).toString('hex'))").Trim() }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw '未找到 docker 命令，请安装并启动 Docker Desktop：https://www.docker.com/products/docker-desktop/'
}
Write-Step '检查 Docker 守护进程'
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker 守护进程未运行，请先启动 Docker Desktop 后重试。'
}

Write-Step '准备 docker-compose 环境变量'
$envPath = Join-Path $root '.env'
$examplePath = Join-Path $root 'deploy\docker-env.example'
if (-not (Test-Path $envPath)) {
    $content = Get-Content $examplePath -Raw
    $secrets = @{
        POSTGRES_PASSWORD = New-Secret
        JWT_SECRET = New-Secret
        JWT_REFRESH_SECRET = New-Secret
        JWT_MEMBER_SECRET = New-Secret
    }
    foreach ($key in $secrets.Keys) {
        $content = [regex]::Replace($content, "(?m)^$key=.*$", "$key=$($secrets[$key])")
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envPath, $content, $utf8NoBom)
    Write-Host '  已生成 .env（含随机 JWT 密钥）'
} else {
    Write-Host '  已存在 .env，直接使用'
}
if ($Seed) {
    $content = Get-Content $envPath -Raw
    $content = [regex]::Replace($content, '(?m)^SEED_DEMO=.*$', 'SEED_DEMO=1')
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envPath, $content, $utf8NoBom)
    Write-Host '  已开启 SEED_DEMO=1（首次启动写入演示数据）'
}

Write-Step '构建并启动容器（API :4000 / Web :3000）'
$upArgs = @('compose', 'up', '-d')
if ($Rebuild) { $upArgs += '--build' }
& docker @upArgs
if ($LASTEXITCODE -ne 0) { throw 'docker compose up 失败' }

Write-Step '等待健康检查'
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    $status = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' xhcms 2>$null)
    if ($status -eq 'healthy') { $healthy = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $healthy) {
    & docker compose logs --tail 60
    throw '容器未在超时时间内变为 healthy，请查看日志：docker compose logs -f'
}

Write-Host ''
Write-Host 'XHCMS Novel 容器已就绪：' -ForegroundColor Green
Write-Host '  门户: http://localhost:3000'
Write-Host '  后台: http://localhost:3000/admin'
Write-Host '  API:  http://localhost:4000/api/v1'
Write-Host ''
Write-Host '查看日志: docker compose logs -f'
Write-Host '停止容器: powershell -ExecutionPolicy Bypass -File deploy\docker-down.ps1'
