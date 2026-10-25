# XHCMS Novel 2.0 - one-click install / environment check (Windows)
# Usage:
#   irm <raw>/install.ps1 | iex
#   & ([scriptblock]::Create((irm <raw>/install.ps1))) -Check
[CmdletBinding()]
param(
    [switch]$Check,
    [string]$RepoUrl = '',
    [string]$Branch = '',
    [string]$TargetDir = ''
)

$ErrorActionPreference = 'Stop'
$script:Missing = 0

function Say([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Bad([string]$msg) { Write-Host "  [XX] $msg" -ForegroundColor Red; $script:Missing = 1 }
function Die([string]$msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Test-Port([int]$port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne(500)) { $client.Close(); return $false }
        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch { return $false }
}

if ($env:XHCMS_REPO_URL) { $RepoUrl = $env:XHCMS_REPO_URL }
if ($env:XHCMS_BRANCH) { $Branch = $env:XHCMS_BRANCH }
if ($env:XHCMS_DIR) { $TargetDir = $env:XHCMS_DIR }
if (-not $RepoUrl) { $RepoUrl = 'https://github.com/544735/xhcms-novel.git' }
if (-not $Branch) { $Branch = 'main' }
if (-not $TargetDir) { $TargetDir = Join-Path (Get-Location) 'xhcms-novel' }

Say 'Environment check'
Write-Host ("  OS   : " + (Get-CimInstance Win32_OperatingSystem).Caption)
Write-Host ("  Arch : " + $env:PROCESSOR_ARCHITECTURE)
Write-Host ("  PS   : " + $PSVersionTable.PSVersion)

if (Get-Command git -ErrorAction SilentlyContinue) { Ok ("git: " + (git --version)) } else { Bad 'git is missing' }
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = (node -p 'process.versions.node')
    if ([int]($nodeVersion.Split('.')[0]) -ge 20) { Ok ("Node.js >= 20 (v$nodeVersion)") } else { Bad ("Node.js too old: v$nodeVersion") }
} else { Bad 'node is missing' }

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Ok ("Docker: " + (docker --version))
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { Ok 'Docker daemon is running' } else { Bad 'Docker daemon is not running' }
    docker compose version *> $null
    if ($LASTEXITCODE -eq 0) { Ok ("Docker Compose: " + (docker compose version)) } else { Bad 'Docker Compose v2 is missing' }
} else { Bad 'docker is missing' }

$webPort = if ($env:WEB_PORT) { [int]$env:WEB_PORT } else { 3000 }
$apiPort = if ($env:API_PORT) { [int]$env:API_PORT } else { 4000 }
foreach ($p in @($webPort, $apiPort)) {
    if (Test-Port $p) { Warn "port $p is in use (set WEB_PORT/API_PORT to change)" } else { Ok "port $p is free" }
}

if (Test-Path (Join-Path $TargetDir '.git')) { Ok "existing repository will be updated: $TargetDir" } else { Ok "target directory: $TargetDir (clone)" }

if ($Check) {
    Say 'Check-only mode: nothing was modified'
    if ($script:Missing -eq 0) { Write-Host 'Environment satisfies the installation requirements.'; exit 0 }
    Die 'environment does not satisfy the requirements'
}
if ($script:Missing -ne 0) { Die 'fix the issues above before installing' }

Say 'Fetching repository'
if (Test-Path (Join-Path $TargetDir '.git')) {
    git -C $TargetDir fetch --depth 1 origin $Branch
    git -C $TargetDir checkout $Branch
    git -C $TargetDir pull --ff-only
} else {
    git clone --branch $Branch --depth 1 $RepoUrl $TargetDir
}
Set-Location $TargetDir

$envPath = Join-Path $TargetDir '.env'
$examplePath = Join-Path $TargetDir 'deploy\docker-env.example'
if (-not (Test-Path $envPath)) { Say 'Generating .env with random secrets'; Copy-Item $examplePath $envPath }

function New-Secret {
    $bytes = New-Object 'System.Byte[]' 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}
$content = Get-Content $envPath -Raw
foreach ($key in @('POSTGRES_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_MEMBER_SECRET')) {
    if ($content -notmatch "(?m)^$key=.+$") {
        $secret = New-Secret
        if ($content -match "(?m)^$key=.*$") { $content = [regex]::Replace($content, "(?m)^$key=.*$", "$key=$secret") }
        else { $content = $content + "$key=$secret`n" }
    }
}
if ($content -notmatch '(?m)^SEED_DEMO=') { $content = $content + "SEED_DEMO=1`n" }
[System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))

Say 'Building and starting containers (first build may take a few minutes)'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Die 'docker compose up failed' }

Say 'Waiting for the application to become ready'
$ready = $false
for ($i = 0; $i -lt 80; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$webPort" -TimeoutSec 5 -UseBasicParsing
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) { $ready = $true; break }
    } catch { $null = $_ }
    Start-Sleep -Seconds 3
}
if (-not $ready) { docker compose logs --tail 80 app; Die 'application did not become ready in time' }

Say 'Installation completed'
Write-Host "Portal:      http://localhost:$webPort"
Write-Host "Admin:       http://localhost:$webPort/admin"
Write-Host "API:         http://localhost:$apiPort/api/v1"
Write-Host 'Admin user:  admin (password: docker compose exec xhcms cat /data/.seed-credentials.txt)'
Write-Host 'Change the password right after the first login and delete that file.'
