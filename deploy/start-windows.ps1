# XHCMS Novel 2.0 —— Windows 启动 / 重启脚本（依赖已安装、已构建时使用）
# 完整一键部署（含依赖安装、环境变量生成、数据库初始化、构建）请用：
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1 -Seed
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'deploy-windows.ps1') -SkipInstall -NoBuild @Rest
exit 0
