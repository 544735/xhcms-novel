# XHCMS Novel 2.0 —— 一键拉取并安装（Windows / Docker Compose + PostgreSQL）
# 用法：
#   pwsh -File scripts\install.ps1
#   $env:XHCMS_DIR='D:\xhcms'; pwsh -File scripts\install.ps1
param(
    [string]$RepoUrl = $(if ($env:XHCMS_REPO_URL) { $env:XHCMS_REPO_URL } else { 'https://github.com/544735/xhcms-novel.git' }),
    [string]$Branch = $(if ($env:XHCMS_BRANCH) { $env:XHCMS_BRANCH } else { 'main' }),
    [string]$TargetDir = $(if ($env:XHCMS_DIR) { $env:XHCMS_DIR } else { (Join-Path (Get-Location) 'xhcms-novel') })
)

$ErrorActionPreference = 'Stop'
function Say($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Die($msg) { Write-Host "错误：$msg" -ForegroundColor Red; exit 1 }

Say '检查环境'
foreach ($cmd in @('git', 'docker', 'node')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Die "缺少依赖：$cmd（请先安装）" }
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Die 'Docker 守护进程未运行，请先启动 Docker Desktop' }
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Die '需要 Docker Compose v2（docker compose）' }

if (Test-Path (Join-Path $TargetDir '.git')) {
    Say "更新已有仓库：$TargetDir"
    git -C $TargetDir fetch --depth 1 origin $Branch
    git -C $TargetDir checkout $Branch
    git -C $TargetDir pull --ff-only
} else {
    Say "拉取仓库到 $TargetDir"
    git clone --branch $Branch --depth 1 $RepoUrl $TargetDir
}

Set-Location $TargetDir
$envPath = Join-Path $TargetDir '.env'
$examplePath = Join-Path $TargetDir 'deploy\docker-env.example'
if (-not (Test-Path $envPath)) {
    Say '生成 .env（随机密钥）'
    Copy-Item $examplePath $envPath
}
$content = Get-Content $envPath -Raw
$gen = { -join ((1..48) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }) }
foreach ($key in @('POSTGRES_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_MEMBER_SECRET')) {
    if ($content -notmatch "(?m)^$key=.+$") {
        $content = [regex]::Replace($content, "(?m)^$key=.*$", "$key=$(& $gen)")
        if ($content -notmatch "(?m)^$key=") { $content += "$key=$(& $gen)`n" }
    }
}
if ($content -notmatch '(?m)^SEED_DEMO=') { $content += "SEED_DEMO=1`n" }
[System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Say '构建并启动（首次构建可能需要几分钟）'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Die 'docker compose up 失败，请查看上方日志' }

Say '等待应用就绪'
$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { '3000' }
$ok = $false
for ($i = 0; $i -lt 80; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$webPort" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
}
if (-not $ok) {
    docker compose logs --tail 80 app
    Die '应用未在预期时间内就绪，请查看上方日志'
}

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { '4000' }
Say '安装完成'
Write-Host "门户：      http://localhost:$webPort"
Write-Host "管理后台：  http://localhost:$webPort/admin"
Write-Host "API：       http://localhost:$apiPort/api/v1"
Write-Host '初始管理员：admin（口令见 docker compose exec xhcms cat /data/.seed-credentials.txt）'
Write-Host '首次登录后请立即修改口令，并删除该凭据文件。'
