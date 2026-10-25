# XHCMS Novel 2.0 - one-click pull & install (Windows / Docker Compose + PostgreSQL)
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
#   $env:XHCMS_DIR='D:\xhcms'; powershell -ExecutionPolicy Bypass -File scripts\install.ps1
param(
    [string]$RepoUrl = 'https://github.com/544735/xhcms-novel.git',
    [string]$Branch = 'main',
    [string]$TargetDir = ''
)

$ErrorActionPreference = 'Stop'

function Say([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Die([string]$msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

if ($env:XHCMS_REPO_URL) { $RepoUrl = $env:XHCMS_REPO_URL }
if ($env:XHCMS_BRANCH) { $Branch = $env:XHCMS_BRANCH }
if ($env:XHCMS_DIR) { $TargetDir = $env:XHCMS_DIR }
if (-not $TargetDir) { $TargetDir = Join-Path (Get-Location) 'xhcms-novel' }

Say 'Checking prerequisites'
foreach ($cmd in @('git', 'docker', 'node')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Die "missing dependency: $cmd" }
}
docker info | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'Docker daemon is not running (start Docker Desktop first)' }
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'Docker Compose v2 is required (docker compose)' }

if (Test-Path (Join-Path $TargetDir '.git')) {
    Say "Updating existing repository: $TargetDir"
    git -C $TargetDir fetch --depth 1 origin $Branch
    git -C $TargetDir checkout $Branch
    git -C $TargetDir pull --ff-only
} else {
    Say "Cloning into $TargetDir"
    git clone --branch $Branch --depth 1 $RepoUrl $TargetDir
}

Set-Location $TargetDir
$envPath = Join-Path $TargetDir '.env'
$examplePath = Join-Path $TargetDir 'deploy\docker-env.example'
if (-not (Test-Path $envPath)) {
    Say 'Generating .env with random secrets'
    Copy-Item $examplePath $envPath
}

function New-Secret {
    $bytes = New-Object 'System.Byte[]' 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}

$content = Get-Content $envPath -Raw
foreach ($key in @('POSTGRES_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_MEMBER_SECRET')) {
    if ($content -notmatch "(?m)^$key=.+$") {
        $secret = New-Secret
        if ($content -match "(?m)^$key=.*$") {
            $content = [regex]::Replace($content, "(?m)^$key=.*$", "$key=$secret")
        } else {
            $content = $content + "$key=$secret`n"
        }
    }
}
if ($content -notmatch '(?m)^SEED_DEMO=') { $content = $content + "SEED_DEMO=1`n" }
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $content, $utf8NoBom)

Say 'Building and starting containers (first build may take a few minutes)'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Die 'docker compose up failed, check the logs above' }

Say 'Waiting for the application to become ready'
$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { '3000' }
$apiPort = if ($env:API_PORT) { $env:API_PORT } else { '4000' }
$ok = $false
for ($i = 0; $i -lt 80; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$webPort" -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { $ok = $true; break }
    } catch {
        $null = $_
    }
    Start-Sleep -Seconds 3
}
if (-not $ok) {
    docker compose logs --tail 80 app
    Die 'application did not become ready in time, check the logs above'
}

Say 'Installation completed'
Write-Host "Portal:      http://localhost:$webPort"
Write-Host "Admin:       http://localhost:$webPort/admin"
Write-Host "API:         http://localhost:$apiPort/api/v1"
Write-Host 'Admin user:  admin (password: docker compose exec xhcms cat /data/.seed-credentials.txt)'
Write-Host 'Change the password right after the first login and delete that file.'
