# XHCMS Novel 2.0 —— 一键发布到 GitHub
#
# 前置：
#   1) 已安装 Git（未安装可执行：winget install --id Git.Git -e）
#   2) 已设置 GitHub Token（建议 Fine-grained / Classic，至少 repo 权限）：
#        $env:GITHUB_TOKEN = "ghp_xxx"        # 当前 PowerShell 会话有效
#      或在系统环境变量中永久配置 GITHUB_TOKEN
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\github-publish.ps1 -Repo "你的用户名/xhcms-novel" -Private
#   powershell -ExecutionPolicy Bypass -File scripts\github-publish.ps1 -Repo "你的用户名/xhcms-novel" -SkipRepoCreate
#
[CmdletBinding()]
param(
    # 仓库标识：owner/name（如 octocat/xhcms-novel）；只写 name 时使用当前 Token 用户
    [Parameter(Mandatory = $true)]
    [string]$Repo,
    [switch]$Private,
    [string]$Branch = 'main',
    [string]$Message = 'chore: initial commit — XHCMS Novel 2.0',
    [string]$UserName = '',
    [string]$UserEmail = '',
    [switch]$SkipRepoCreate
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step([string]$text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok([string]$text) { Write-Host "✅ $text" -ForegroundColor Green }

Write-Step '检查 Git 与运行环境'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw @'
未找到 git。请安装 Git 后重试：
  winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
或下载：https://git-scm.com/download/win
安装后重开终端，再执行本脚本。
'@
}
Write-Host ('  git ' + ((git --version) -replace '^git version ', ''))

$token = $env:GITHUB_TOKEN
if (-not $token) { $token = $env:GH_TOKEN }

# 解析 owner/name
$owner = ''
$name = $Repo
if ($Repo.Contains('/')) {
    $owner = $Repo.Split('/')[0]
    $name = $Repo.Split('/')[1]
}
if (-not $owner) {
    if ($token) {
        $headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'xhcms-publish' }
        $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers -Method Get
        $owner = $me.login
    } else {
        throw '请使用 owner/name 形式指定仓库（例如 yourname/xhcms-novel），或先设置 GITHUB_TOKEN'
    }
}
$repoFullName = "$owner/$name"
Write-Host "  目标仓库：$repoFullName（分支 $Branch）"

function Invoke-GitHubApi {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = '')
    try {
        if ($Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -Body $Body -ContentType 'application/json'
        }
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 404) { return $null }
        throw
    }
}

Write-Step '创建 GitHub 仓库（如不存在）'
if (-not $SkipRepoCreate) {
    if (-not $token) { throw '自动创建仓库需要 GITHUB_TOKEN；如仓库已存在请加 -SkipRepoCreate' }
    $headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'xhcms-publish' }
    $existing = Invoke-GitHubApi -Method Get -Uri "https://api.github.com/repos/$repoFullName" -Headers $headers
    if ($existing) {
        Write-Host "  仓库已存在，跳过创建：$($existing.html_url)"
    } else {
        $body = @{
            name        = $name
            private     = [bool]$Private
            description = 'XHCMS Novel 2.0 — 现代化小说网站（NestJS + Next.js + Prisma）'
            auto_init   = $false
        } | ConvertTo-Json
        $me = Invoke-GitHubApi -Method Get -Uri 'https://api.github.com/user' -Headers $headers
        if ($me.login -eq $owner) {
            $created = Invoke-GitHubApi -Method Post -Uri 'https://api.github.com/user/repos' -Headers $headers -Body $body
        } else {
            $created = Invoke-GitHubApi -Method Post -Uri "https://api.github.com/orgs/$owner/repos" -Headers $headers -Body $body
        }
        Write-Ok "已创建仓库：$($created.html_url)"
    }
} else {
    Write-Host '  已跳过仓库创建（-SkipRepoCreate）'
}

Write-Step '初始化本地 Git 仓库并提交'
if (-not (Test-Path (Join-Path $root '.git'))) {
    git init | Out-Null
    git checkout -b $Branch 2>$null
    if ($LASTEXITCODE -ne 0) { git branch -M $Branch }
    Write-Host "  已初始化仓库（分支 $Branch）"
} else {
    Write-Host '  已存在 .git，追加提交'
}

$currentName = git config user.name
$currentEmail = git config user.email
if (-not $currentName -or -not $currentEmail) {
    $fallbackName = if ($UserName) { $UserName } else { 'XHCMS' }
    $fallbackEmail = if ($UserEmail) { $UserEmail } else { 'xhcms@users.noreply.github.com' }
    git config user.name $fallbackName
    git config user.email $fallbackEmail
    Write-Host "  已设置本仓库提交身份：$fallbackName <$fallbackEmail>"
}

git add -A
$status = git status --porcelain
if ($status) {
    git commit -m $Message | Out-Null
    Write-Ok '已创建提交'
} else {
    Write-Host '  工作区无变更，跳过提交'
}

Write-Step '配置远端并推送'
$remoteUrl = "https://github.com/$repoFullName.git"
$remotes = git remote
if ($remotes -contains 'origin') {
    git remote set-url origin $remoteUrl
} else {
    git remote add origin $remoteUrl
}

if ($token) {
    # 使用一次性认证 URL 推送，不写入 .git/config
    git -c credential.helper= push "https://x-access-token:$token@github.com/$repoFullName.git" "HEAD:refs/heads/$Branch"
    if ($LASTEXITCODE -ne 0) { throw '推送失败：请检查 Token 权限（需要 repo 写权限）与仓库名' }
    git remote set-url origin $remoteUrl
    git fetch origin $Branch | Out-Null
    git branch --set-upstream-to "origin/$Branch" | Out-Null
    Write-Ok "已推送（使用 GITHUB_TOKEN，未写入本地凭据）"
} else {
    Write-Host '  未检测到 GITHUB_TOKEN，使用系统凭据管理器推送（可能弹出登录窗口）…'
    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { throw '推送失败：请先登录 GitHub（git 凭据管理器 / gh auth login），或设置 GITHUB_TOKEN' }
    Write-Ok '已推送'
}

Write-Host ''
Write-Host "仓库地址：https://github.com/$repoFullName" -ForegroundColor Green
Write-Host '后续更新：' 
Write-Host '  git add -A && git commit -m "feat: ..." && git push'
Write-Host '发布版本：git tag v2.0.0 && git push origin v2.0.0   # 触发 Release / Docker 工作流'
