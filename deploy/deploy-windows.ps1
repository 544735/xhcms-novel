# ============================================================================
# XHCMS Novel 2.0 —— Windows 一键部署脚本
#
# 功能：环境检查 → 生成/补全环境变量与随机密钥 → 安装依赖 → 初始化数据库
#       → （可选）写入演示数据 → 构建 → 停止旧进程 → 后台启动 → 健康检查
#
# 常用用法：
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1 -Seed        # 附带演示数据
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1 -SkipInstall # 依赖已装
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1 -NoBuild     # 只重启
#   powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1 -PublicUrl "http://demo.example.com"
#
# 参数：
#   -ApiPort       API 端口（默认 4000，仅在新建环境变量时写入）
#   -WebPort       Web 端口（默认 3000，仅在新建环境变量时写入）
#   -PublicUrl     对外访问地址（默认 http://localhost:<WebPort>）
#   -Seed          初始化/重置演示数据（会清空数据库！）
#   -SkipInstall   跳过 pnpm install
#   -NoBuild       跳过构建（仅重启服务）
#   -NoStart       只准备与构建，不启动服务
#   -FreshEnv      强制重新生成 .env / .env.local（旧文件自动备份）
#   -TimeoutSec    健康检查超时秒数（默认 120）
# ============================================================================
[CmdletBinding()]
param(
    [int]$ApiPort = 4000,
    [int]$WebPort = 3000,
    [string]$PublicUrl = '',
    [switch]$Seed,
    [switch]$SkipInstall,
    [switch]$NoBuild,
    [switch]$NoStart,
    [switch]$FreshEnv,
    [int]$TimeoutSec = 120
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$deployLog = Join-Path $logDir "deploy-$timestamp.log"

function Write-Log([string]$message, [string]$level = 'INFO') {
    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'HH:mm:ss'), $level, $message
    Write-Host $line
    Add-Content -Path $deployLog -Value $line -Encoding UTF8
}
function Write-Step([string]$message) {
    Write-Host ''
    Write-Host "==> $message" -ForegroundColor Cyan
    Add-Content -Path $deployLog -Value "==> $message" -Encoding UTF8
}
function Require-Command([string]$name, [string]$hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "未找到 $name。$hint"
    }
}
function Invoke-Step([string]$command, [string]$description) {
    Write-Log "执行：$command"
    cmd /c $command
    if ($LASTEXITCODE -ne 0) { throw "$description 失败（退出码 $LASTEXITCODE）" }
}
function Get-EnvValue([string]$content, [string]$key) {
    $match = [regex]::Match($content, "(?m)^$key=(.*)$")
    if (-not $match.Success) { return $null }
    return $match.Groups[1].Value.Trim().Trim('"')
}
function Set-EnvValue([string]$content, [string]$key, [string]$value) {
    $line = "$key=`"$value`""
    if ([regex]::IsMatch($content, "(?m)^$key=.*$")) {
        return [regex]::Replace($content, "(?m)^$key=.*$", $line)
    }
    return ($content.TrimEnd() + "`r`n" + $line + "`r`n")
}
function New-Secret {
    $value = (& node -e "console.log(require('crypto').randomBytes(48).toString('hex'))").Trim()
    if (-not $value -or $value.Length -lt 32) { throw '随机密钥生成失败' }
    return $value
}
function Write-Utf8NoBom([string]$path, [string]$text) {
    # .env 使用无 BOM 的 UTF-8，避免部分 dotenv 解析器把 BOM 当作首个键名的一部分
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}
function Stop-Port([int]$port) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
            Write-Log "已停止端口 $port 上的进程 PID $($connection.OwningProcess)"
        } catch {
            Write-Log "停止端口 $port 进程失败：$($_.Exception.Message)" 'WARN'
        }
    }
}
function Wait-Http([string]$url, [int]$timeoutSec) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    $lastError = ''
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return $true }
            $lastError = "HTTP $($response.StatusCode)"
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    Write-Log "健康检查超时：$url（最后错误：$lastError）" 'ERROR'
    return $false
}

Write-Log "XHCMS Novel 一键部署开始（日志：$deployLog）"
Write-Step '1/8 检查运行环境'
Require-Command 'node' '请安装 Node.js >= 20（https://nodejs.org）'
Require-Command 'pnpm' '请执行 corepack enable，或 npm i -g pnpm'
$nodeVersion = (& node --version).Trim()
$pnpmVersion = (& cmd /c "pnpm --version").Trim()
Write-Log "Node.js $nodeVersion / pnpm $pnpmVersion"
$nodeMajor = [int](($nodeVersion -replace '^v', '').Split('.')[0])
if ($nodeMajor -lt 20) { throw "Node.js 版本过低（$nodeVersion），需要 >= 20" }

if (-not $PublicUrl) { $PublicUrl = "http://localhost:$WebPort" }
$PublicUrl = $PublicUrl.TrimEnd('/')
Write-Log "对外地址：$PublicUrl ｜ API 端口：$ApiPort ｜ Web 端口：$WebPort"

Write-Step '2/8 生成 / 校验收环境变量'
$apiEnvPath = Join-Path $root 'apps\api\.env'
$apiEnvExample = Join-Path $root 'apps\api\.env.example'
$webEnvPath = Join-Path $root 'apps\web\.env.local'
$webEnvExample = Join-Path $root 'apps\web\.env.example'

if ((Test-Path $apiEnvPath) -and $FreshEnv) {
    $backup = "$apiEnvPath.$timestamp.bak"
    Copy-Item $apiEnvPath $backup -Force
    Write-Log "已备份旧 .env -> $backup"
    Remove-Item $apiEnvPath -Force
}
if (-not (Test-Path $apiEnvPath)) {
    $secrets = @{
        JWT_SECRET = New-Secret
        JWT_REFRESH_SECRET = New-Secret
        JWT_MEMBER_SECRET = New-Secret
    }
    # 密钥在部署时随机生成并直接写入 .env；源码中不存在任何固定密钥。
    $q = [char]34
    $envLines = @(
        ('# XHCMS Novel 2.0 API 环境变量（由 deploy-windows.ps1 于 ' + $timestamp + ' 生成）'),
        ('DATABASE_URL=' + $q + 'file:./dev.db' + $q),
        ('PORT=' + $ApiPort),
        'NODE_ENV=production',
        ('JWT_SECRET=' + $q + $secrets.JWT_SECRET + $q),
        ('JWT_REFRESH_SECRET=' + $q + $secrets.JWT_REFRESH_SECRET + $q),
        ('JWT_MEMBER_SECRET=' + $q + $secrets.JWT_MEMBER_SECRET + $q),
        ('CORS_ORIGINS=' + $q + $PublicUrl + $q),
        ('UPLOAD_DIR=' + $q + 'uploads' + $q),
        ('PUBLIC_BASE_URL=' + $q + $PublicUrl + $q)
    )
    $content = ($envLines -join "`r`n") + "`r`n"
    Write-Utf8NoBom $apiEnvPath $content
    Write-Log '已生成 apps/api/.env（含随机 JWT 密钥、生产模式）'
} else {
    # 显式用 UTF-8 读取（PowerShell 5.1 默认 ANSI 会破坏中文注释），并统一换行
    $content = [System.IO.File]::ReadAllText($apiEnvPath, (New-Object System.Text.UTF8Encoding($false)))
    $content = ($content -replace "`r`n", "`n") -replace "`r", "`n"

    $envPort = Get-EnvValue $content 'PORT'
    if ($envPort -and ([int]$envPort -ne $ApiPort)) {
        Write-Log "注意：.env 中 PORT=$envPort 与 -ApiPort=$ApiPort 不一致，以 .env 为准" 'WARN'
        $ApiPort = [int]$envPort
    }

    # 关键项缺失时补全，避免手工编辑后无法启动
    $requiredDefaults = [ordered]@{
        'DATABASE_URL' = 'file:./dev.db'
        'PORT' = [string]$ApiPort
        'NODE_ENV' = 'production'
        'CORS_ORIGINS' = $PublicUrl
        'UPLOAD_DIR' = 'uploads'
        'PUBLIC_BASE_URL' = $PublicUrl
    }
    foreach ($key in $requiredDefaults.Keys) {
        if (-not (Get-EnvValue $content $key)) {
            $content = Set-EnvValue $content $key $requiredDefaults[$key]
            Write-Log "已在 .env 中补全：$key"
        }
    }
    foreach ($pair in @(@('JWT_SECRET', '管理端访问令牌'), @('JWT_REFRESH_SECRET', '管理端刷新令牌'), @('JWT_MEMBER_SECRET', '会员令牌'))) {
        $key = $pair[0]
        if (-not (Get-EnvValue $content $key)) {
            $content = Set-EnvValue $content $key (New-Secret)
            Write-Log "已在 .env 中补全随机密钥：$key"
        }
    }
    $cors = Get-EnvValue $content 'CORS_ORIGINS'
    if ($cors -and ($cors -notlike "*$PublicUrl*")) {
        Write-Log "注意：CORS_ORIGINS=$cors 未包含 $PublicUrl，如跨域访问失败请手动补充" 'WARN'
    }
    $content = (($content.TrimEnd() -replace "`n", "`r`n")) + "`r`n"
    Write-Utf8NoBom $apiEnvPath $content
    Write-Log '已校验 apps/api/.env（存在即保留，仅补全缺失项）'
}

if ((Test-Path $webEnvPath) -and $FreshEnv) {
    $backup = "$webEnvPath.$timestamp.bak"
    Copy-Item $webEnvPath $backup -Force
    Write-Log "已备份旧 .env.local -> $backup"
    Remove-Item $webEnvPath -Force
}
if (-not (Test-Path $webEnvPath)) {
    $hostPart = ([uri]$PublicUrl).Host
    $isLocal = ($hostPart -in @('localhost', '127.0.0.1', '::1'))
    if ($isLocal) {
        $publicApi = "http://localhost:$ApiPort/api/v1"
    } else {
        $publicApi = "$PublicUrl/api/v1"
    }
    $internalApi = "http://127.0.0.1:$ApiPort/api/v1"
    $webContent = @"
NEXT_PUBLIC_API_URL="$publicApi"
API_INTERNAL_URL="$internalApi"
NEXT_PUBLIC_DEFAULT_SITE="books"
NEXT_PUBLIC_SITE_URL="$PublicUrl"
NEXT_PUBLIC_SITE_HOSTS=""
"@
    Write-Utf8NoBom $webEnvPath $webContent
    Write-Log "已生成 apps/web/.env.local（API：$publicApi）"
} else {
    Write-Log '已检测到 apps/web/.env.local（存在即保留）'
}

Write-Step '3/8 停止旧服务进程'
Stop-Port $ApiPort
Stop-Port $WebPort

Write-Step '4/8 安装依赖'
if ($SkipInstall) {
    Write-Log '已跳过依赖安装（-SkipInstall）'
} else {
    Invoke-Step 'pnpm install --reporter=append-only' '依赖安装'
}

Write-Step '5/8 初始化数据库'
Invoke-Step 'pnpm --filter @wmcms/api db:push' '数据库结构同步'

Write-Step '6/8 构建'
if ($NoBuild) {
    Write-Log '已跳过构建（-NoBuild）'
} else {
    Invoke-Step 'pnpm build' '生产构建'
}

if ($Seed) {
    Write-Step '7/8 写入演示数据（会清空数据库）'
    Invoke-Step 'pnpm --filter @wmcms/api db:seed' '演示数据初始化'
} else {
    Write-Step '7/8 跳过演示数据（如需初始化演示数据请加 -Seed）'
}

Write-Step '8/8 启动服务与健康检查'
if ($NoStart) {
    Write-Log '已跳过启动（-NoStart）'
} else {
    Start-Process -FilePath 'cmd.exe' -ArgumentList "/c pnpm --filter @wmcms/api start > `"$logDir\api.log`" 2>&1" -WindowStyle Hidden
    Write-Log 'API 启动中…'
    $apiReady = Wait-Http "http://127.0.0.1:$ApiPort/api/v1/health" $TimeoutSec
    Start-Process -FilePath 'cmd.exe' -ArgumentList "/c pnpm --filter @wmcms/web start > `"$logDir\web.log`" 2>&1" -WindowStyle Hidden
    Write-Log 'Web 启动中…'
    $webReady = Wait-Http "http://127.0.0.1:$WebPort/" $TimeoutSec

    if (-not $apiReady) {
        Write-Log 'API 启动失败，最近日志：' 'ERROR'
        if (Test-Path (Join-Path $logDir 'api.log')) { Get-Content (Join-Path $logDir 'api.log') -Tail 40 | ForEach-Object { Write-Log $_ 'API' } }
        throw '部署失败：API 健康检查未通过'
    }
    if (-not $webReady) {
        Write-Log 'Web 启动失败，最近日志：' 'ERROR'
        if (Test-Path (Join-Path $logDir 'web.log')) { Get-Content (Join-Path $logDir 'web.log') -Tail 40 | ForEach-Object { Write-Log $_ 'WEB' } }
        throw '部署失败：Web 健康检查未通过'
    }
    Write-Log '健康检查通过：API /health 200，门户首页 200' 'OK'
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  XHCMS Novel 2.0 部署完成' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  门户首页:  $PublicUrl"
Write-Host "  管理后台:  $PublicUrl/admin"
Write-Host "  API:       http://localhost:$ApiPort/api/v1"
Write-Host "  API 文档:  http://localhost:$ApiPort/api/docs"
Write-Host ''
Write-Host '  演示账号:  admin / Admin@123456（首次部署建议加 -Seed）'
Write-Host "  服务日志:  logs\api.log  /  logs\web.log"
Write-Host "  部署日志:  $deployLog"
Write-Host '  停止服务:  powershell -ExecutionPolicy Bypass -File deploy\stop-windows.ps1'
Write-Host ''
# 显式成功退出码，避免外层自动化误判（PowerShell -File 会继承脚本内原生命令的退出码）
exit 0
