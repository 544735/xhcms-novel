# XHCMS Novel 2.0 —— Windows 停止服务脚本
# 用法：powershell -ExecutionPolicy Bypass -File deploy\stop-windows.ps1
#       powershell -ExecutionPolicy Bypass -File deploy\stop-windows.ps1 -ApiPort 4000 -WebPort 3000
[CmdletBinding()]
param(
    [int]$ApiPort = 4000,
    [int]$WebPort = 3000
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Stop-Service-Port([int]$port, [string]$label) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "  $label（端口 $port）未在运行"
        return
    }
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
            Write-Host "  已停止 $label（端口 $port，PID $($connection.OwningProcess)）"
        } catch {
            Write-Host "  停止 $label 失败：$($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host '==> 停止 XHCMS Novel 服务' -ForegroundColor Cyan
Stop-Service-Port $ApiPort 'API'
Stop-Service-Port $WebPort 'Web'
foreach ($name in @('api', 'web')) {
    $pidFile = Join-Path $logDir "$name.pid"
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
}
Write-Host '完成。' -ForegroundColor Green
