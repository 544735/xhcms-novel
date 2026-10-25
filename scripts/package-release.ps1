# 构建发布包：release/xhcms-novel-<version>/ 与 release/xhcms-novel-<version>.zip
# 用法：powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1
[CmdletBinding()]
param(
    [string]$Version = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $Version) {
    $Version = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
}
$name = "xhcms-novel-$Version"
$releaseDir = Join-Path $root 'release'
$stage = Join-Path $releaseDir $name
$zip = Join-Path $releaseDir "$name.zip"

Write-Host "==> 版本 $Version" -ForegroundColor Cyan
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

function Copy-Tree([string]$source, [string]$target, [string[]]$excludeDirs, [string[]]$excludeFiles) {
    if (-not (Test-Path $source)) { throw "源目录不存在: $source" }
    $args = @($source, $target, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1')
    if ($excludeDirs.Count -gt 0) { $args += '/XD'; $args += $excludeDirs }
    if ($excludeFiles.Count -gt 0) { $args += '/XF'; $args += $excludeFiles }
    $process = Start-Process -FilePath 'robocopy.exe' -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ge 8) { throw "复制失败($($process.ExitCode)): $source" }
}

$excludeDirs = @('node_modules', '.next', 'dist', 'uploads', 'coverage', '.turbo', 'test-results')
$excludeFiles = @('.env', 'dev.db', 'dev.db-wal', 'dev.db-shm', 'test.db', '*.log', '*.tsbuildinfo')

Write-Host '==> 复制源码' -ForegroundColor Cyan
Copy-Tree (Join-Path $root 'apps\api') (Join-Path $stage 'apps\api') $excludeDirs $excludeFiles
Copy-Tree (Join-Path $root 'apps\web') (Join-Path $stage 'apps\web') $excludeDirs $excludeFiles
Copy-Tree (Join-Path $root 'packages\shared') (Join-Path $stage 'packages\shared') $excludeDirs $excludeFiles
Copy-Tree (Join-Path $root 'docs') (Join-Path $stage 'docs') @() @()
Copy-Tree (Join-Path $root 'screenshots') (Join-Path $stage 'screenshots') @() @()
Copy-Tree (Join-Path $root 'scripts') (Join-Path $stage 'scripts') @() @()
Copy-Tree (Join-Path $root 'deploy') (Join-Path $stage 'deploy') @() @()
Copy-Tree (Join-Path $root '.github') (Join-Path $stage '.github') @() @()

Write-Host '==> 复制根文件' -ForegroundColor Cyan
foreach ($file in @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'README.md', 'RELEASE_NOTES.md', 'VERSION', '.gitignore', '.gitattributes', 'LICENSE', 'Dockerfile', 'docker-compose.yml', '.dockerignore')) {
    $source = Join-Path $root $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $stage $file) -Force }
}

# 上传目录占位
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'apps\api\uploads') | Out-Null
Set-Content -Path (Join-Path $stage 'apps\api\uploads\.gitkeep') -Value '' -Encoding UTF8

# 包根目录的《使用手册》（图片路径改为 screenshots/，便于独立打开）
$manual = Join-Path $root 'docs\使用手册.md'
$manualText = (Get-Content $manual -Raw -Encoding UTF8) -replace '\(\.\./screenshots/', '(screenshots/'
Set-Content -Path (Join-Path $stage '使用手册.md') -Value $manualText -Encoding UTF8
$docx = Join-Path $root 'docs\XHCMS小说站使用手册.docx'
if (Test-Path $docx) { Copy-Item $docx (Join-Path $stage 'XHCMS小说站使用手册.docx') -Force }

Write-Host '==> 生成 ZIP' -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
if (Test-Path $zip) { Remove-Item $zip -Force }
$basePath = (Resolve-Path $stage).Path
$zipStream = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
try {
    $archiveWriter = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem -LiteralPath $stage -Recurse -Force -File | ForEach-Object {
            # ZIP 规范使用正斜杠，保证跨平台解压正常
            $relative = $_.FullName.Substring($basePath.Length + 1).Replace('\', '/')
            $entry = $archiveWriter.CreateEntry("$name/$relative", [System.IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = $_.LastWriteTime
            $entryStream = $entry.Open()
            try {
                $fileStream = [System.IO.File]::OpenRead($_.FullName)
                try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose() }
            } finally { $entryStream.Dispose() }
        }
    } finally { $archiveWriter.Dispose() }
} finally { $zipStream.Dispose() }

$zipInfo = Get-Item $zip
$sha = (Get-FileHash $zip -Algorithm SHA256).Hash

Write-Host '==> 校验包内容' -ForegroundColor Cyan
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
    $entries = $archive.Entries
    $required = @(
        "$name/README.md",
        "$name/使用手册.md",
        "$name/XHCMS小说站使用手册.docx",
        "$name/RELEASE_NOTES.md",
        "$name/VERSION",
        "$name/apps/api/src/main.ts",
        "$name/apps/api/prisma/schema.prisma",
        "$name/apps/web/src/app/(portal)/layout.tsx",
        "$name/packages/shared/src/types.ts",
        "$name/deploy/start-windows.ps1",
        "$name/screenshots/01-home.png"
    )
    $paths = $entries | ForEach-Object { $_.FullName }
    $missing = $required | Where-Object { $paths -notcontains $_ }
    if ($missing) { throw "包内缺少必要文件: $($missing -join ', ')" }
    $bad = $paths | Where-Object { $_ -match 'node_modules/|\.next/|/dist/|dev\.db|/\.env$' }
    if ($bad) { throw "包内包含不应发布的文件: $($bad -join ', ')" }
    Write-Host ("    条目数: {0}" -f $entries.Count)
} finally {
    $archive.Dispose()
}

$sizeMb = [math]::Round($zipInfo.Length / 1MB, 2)
Write-Host ''
Write-Host '发布包构建完成：' -ForegroundColor Green
Write-Host "  目录: $stage"
Write-Host "  ZIP : $zip"
Write-Host "  大小: $sizeMb MB"
Write-Host "  SHA256: $sha"
