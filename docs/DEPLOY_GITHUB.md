# GitHub 仓库发布与 CI/CD 部署指南

> 本文覆盖：把项目推送到 GitHub、GitHub Actions 自动化（CI / Release / Docker 镜像）、Docker Compose 自托管部署。
> 常规部署（Windows/Linux 一键脚本）见 [使用手册 §7](使用手册.md#7-部署与运维)。

## 1. 前置准备

| 依赖 | 说明 |
| --- | --- |
| Git | Windows：`winget install --id Git.Git -e`；其他平台：<https://git-scm.com/downloads> |
| GitHub 账号 | 用于创建仓库 |
| Personal Access Token | Fine-grained 或 Classic PAT，至少 `repo` 权限（创建仓库 + 推送） |
| Docker（可选） | 自托管容器部署需要 Docker Engine / Docker Desktop |

设置 Token（仅当前终端会话可见，不会写入仓库）：

```powershell
# Windows PowerShell
$env:GITHUB_TOKEN = "ghp_xxxxxxxx"      # 或用系统环境变量永久配置
```

```bash
# Linux / macOS
export GITHUB_TOKEN=ghp_xxxxxxxx
```

> ⚠️ 不要把 Token 直接写进命令行历史、脚本或 `.env` 后提交。GitHub Actions 内的 `GITHUB_TOKEN` 由平台自动注入，无需手动配置。

## 2. 一键推送到 GitHub

**Windows**

```powershell
# 创建私有仓库并推送（仓库名可自定义）
powershell -ExecutionPolicy Bypass -File scripts\github-publish.ps1 -Repo "你的用户名/xhcms-novel" -Private

# 仓库已存在时跳过创建
powershell -ExecutionPolicy Bypass -File scripts\github-publish.ps1 -Repo "你的用户名/xhcms-novel" -SkipRepoCreate
```

**Linux / macOS**

```bash
bash scripts/github-publish.sh 你的用户名/xhcms-novel --private
```

脚本会：初始化本地 Git 仓库 → 生成首次提交 → 调用 GitHub API 创建仓库（私有/公开）→ 配置 `origin` → 使用 Token 推送（Token 不落盘）→ 设置上游分支。

### 手动推送（等价命令）

```bash
git init -b main
git add -A
git commit -m "chore: initial commit — XHCMS Novel 2.0"
git remote add origin https://github.com/你的用户名/xhcms-novel.git
git push -u origin main
```

### 不会上传的内容

`.gitignore` 已排除：`node_modules/`、`.next/`、`dist/`、`release/`、`logs/`、`.env`、`dev.db`、`uploads/`、`*.log` 等。
截图 `screenshots/`、文档 `docs/`（含 Word 手册）会随仓库提交，用于 README 展示。

## 3. GitHub Actions 工作流

仓库内置 3 个 workflow（位于 `.github/workflows/`）：

| 工作流 | 触发 | 内容 |
| --- | --- | --- |
| `ci.yml` | push / PR 到 `main`、手动 | pnpm 安装 → build:shared → typecheck → build → 初始化测试库 → API e2e（21 项） |
| `release.yml` | 推送 `v*` Tag、手动 | Windows 运行 `scripts/package-release.ps1` 生成发布 ZIP，上传 Artifact 并创建 GitHub Release |
| `docker.yml` | 推送 `v*` Tag、手动 | 构建 Docker 镜像并推送到 GHCR（`ghcr.io/<owner>/<repo>`，标签含版本号与 latest） |

### 发布一个新版本

```bash
git tag v2.0.0
git push origin v2.0.0
```

执行后：
- **Actions → Release** 生成 `xhcms-novel-2.0.0.zip` 并挂到 Releases；
- **Actions → Docker Image** 推送 `ghcr.io/<owner>/xhcms-novel:v2.0.0` 与 `:latest`。

> 若 `docker.yml` 推送 GHCR 失败，检查仓库 Settings → Actions → General → Workflow permissions 是否为 `Read and write permissions`。

## 4. Docker 自托管部署

### 4.1 本地/服务器一键启动

```bash
# 1) 准备环境变量（脚本会自动生成三个随机 JWT 密钥）
powershell -ExecutionPolicy Bypass -File deploy\docker-up.ps1 -Rebuild -Seed   # Windows
bash deploy/docker-up.sh --rebuild --seed                                       # Linux / macOS
```

或手动：

```bash
cp deploy/docker-env.example .env
# 编辑 .env：填写 PUBLIC_URL / NEXT_PUBLIC_API_URL / 三个 JWT 密钥（可用 node/openssl 生成）
docker compose up -d --build
docker compose logs -f
```

默认端口：门户 `3000`、API `4000`；数据（SQLite 与上传文件）保存在命名卷 `xhcms-data`。

### 4.2 反向代理与域名

对外暴露时建议 Nginx 统一入口：

- 门户：`https://your-domain.com/` → `http://127.0.0.1:3000`
- API：`https://your-domain.com/api/` → `http://127.0.0.1:4000`（或复用 `deploy/nginx.conf.example`）
- 构建镜像时把 `NEXT_PUBLIC_API_URL` 设为浏览器实际访问的 API 地址：

```bash
# .env 中
PUBLIC_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
CORS_ORIGINS 由 PUBLIC_URL 自动使用
```

修改后重新构建：`docker compose up -d --build`。

### 4.3 首次数据与演示账号

- `.env` 中 `SEED_DEMO=1` 时，首次启动会写入演示数据（7 本书 / 70 章 / 双站点 / VIP 订单 / 书评 / 采集书源），入口脚本会在 `/data/.seeded` 写初始化标记，之后的重启不会重复灌数据；初始化完成后建议改回 `0`；
- 生产环境（`NODE_ENV=production`）首次 seed 未提供 `SEED_*_PASSWORD` 时会**随机生成**管理员口令并写入 `apps/api/.seed-credentials.txt`（容器内可用 `SEED_CREDENTIALS_FILE` 指到 `/data` 卷），日志不打印口令：`docker compose exec xhcms cat /app/apps/api/.seed-credentials.txt` 读取；也可在 seed 前用 `SEED_ADMIN_PASSWORD` / `SEED_EDITOR_PASSWORD` / `SEED_OPERATOR_PASSWORD` / `SEED_MEMBER_PASSWORD` 指定。首个登录后请立即改密并删除该文件。仅本地开发/演示（`NODE_ENV` 非 production）才使用 `Admin@123456` 等默认口令；
- 生产环境务必使用随机 JWT 密钥（脚本已自动生成）。

### 4.4 数据备份与升级

```bash
# 备份数据卷（SQLite + uploads）
docker run --rm -v xhcms_xhcms-data:/data -v "$PWD/backups":/backup alpine tar czf /backup/xhcms-$(date +%F).tgz -C /data .

# 升级：拉取新代码后重建
docker compose up -d --build
```

> 数据卷命名以 `docker volume ls` 实际显示为准（Compose project 名前缀 + `xhcms-data`）。

## 5. 常见问题

| 问题 | 处理 |
| --- | --- |
| `git: command not found` | 安装 Git，或运行 `winget install --id Git.Git -e` 后重开终端 |
| 推送 401 / 403 | Token 无 `repo` 写权限，或仓库名有误；重新生成 Token 并设置 `GITHUB_TOKEN` |
| 创建仓库 422 | 同名仓库已存在（加 `-SkipRepoCreate` / `--skip-create`），或用户名与 Token 不匹配 |
| Actions 中 e2e 失败 | 检查 `apps/api/.env` 是否由 workflow 从 example 生成；本地先跑 `pnpm typecheck && pnpm test` |
| GHCR 推送被拒 | 仓库 Settings → Actions → Workflow permissions 改为 Read and write |
| Docker 构建很慢 | 首次需拉取 node 镜像与依赖；后续利用 BuildKit 缓存 |
| 容器启动后 502 | 查看 `docker compose logs -f`；确认 `.env` 中三个 JWT 密钥非空，数据卷可写 |
| SQLite 并发有限 | 高流量建议切换 PostgreSQL（仅需改 Prisma provider 与 DATABASE_URL） |

## 6. 相关文件

```
.github/workflows/ci.yml        # 类型检查 + 构建 + e2e
.github/workflows/release.yml   # Tag 自动打发布包 + Release
.github/workflows/docker.yml    # Tag 自动构建 GHCR 镜像
Dockerfile                      # 单镜像（API + Web）
docker-compose.yml              # Compose 部署（持久化卷/健康检查）
deploy/docker-entrypoint.sh     # 容器入口（db push + 双服务启动）
deploy/docker-up.* / docker-down.*  # Docker 一键启停
deploy/docker-env.example       # Docker 环境变量模板
scripts/github-publish.ps1/.sh  # GitHub 一键建仓 + 推送
```
