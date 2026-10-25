# XHCMS Novel 2.0.0 发布说明

发布日期：2026-10-25
版本号：2.0.0

## 亮点

- **小说站全新领域模型**：书籍 / 分卷 / 章节 / 书架 / 阅读进度 / 书评章评 / 钱包 / 订单 / 解锁 / 作者档案 / 书源采集。
- **沉浸式阅读器**：字号、行高、宽度、5 种背景、目录抽屉、键盘翻页、每 20% 自动保存进度、VIP 试读与解锁。
- **VIP 付费体系**：书币钱包、4 档充值套餐、模拟支付、章节解锁事务化（幂等）、消费/充值流水。
- **作者中心**：读者申请 → 后台审核 → 作品管理 → 章节编辑（草稿/发布/VIP 定价）→ 数据概览。
- **采集中心**：HTML（CSS 选择器）与 JSON（点号路径）双模式，试采集预览、正式采集（新建/追加、去重、限速）、任务记录、内置演示书源。
- **TXT 批量导入**：UTF-8/GBK 自动识别、正则分章、自动重算字数与章节数。
- **一键部署脚本**：Windows（PowerShell）/ Linux（Bash）自动生成环境变量与随机密钥、安装依赖、初始化数据库、构建、后台启动与健康检查；附带停止/重启脚本、systemd 模式、Nginx 示例。成功返回 0，失败返回非 0，可直接用于 CI。
- **Docker / GitHub CI/CD**：`Dockerfile` + `docker-compose.yml`（含健康检查与数据卷、一键启停脚本）；GitHub Actions 覆盖 CI（类型检查/构建/e2e）、Tag 自动 Release、GHCR 镜像构建；`scripts/github-publish.*` 一键建仓推送。
- **多站点 + 3 套主题**：星海夜读（modern）/ 墨香书卷（magazine）/ 极简纯读（minimal）。
- **5 个内置插件**：章节阅读统计、VIP 章节保护、书籍 SEO、评论安全卫士、Sitemap 增强。
- **后台**：小说仪表盘（含插件洞察）、书籍/章节管理、评论审核、VIP 订单、作者审核、分类、媒体、站点、主题、插件、RBAC（65 权限 / 4 角色）、审计日志、站点设置。
- **SEO**：书籍/章节/分类/作者 metadata、canonical/OG、sitemap.xml、rss.xml、robots.txt。

## 验收结果

| 项目 | 结果 |
| --- | --- |
| `pnpm typecheck` | 0 错误（shared / api / web 全包 strict） |
| `pnpm build` | 成功（Nest 产物 + Next 生产构建） |
| `pnpm test`（API e2e） | 21/21 通过 |
| 门户路由 | 首页/书库/分类/详情/阅读器（含 VIP 锁定）/排行/搜索/作者页/sitemap/rss/robots 均 200，错误资源正确 404 |
| 后台路由 | 仪表盘/书籍/分类/采集/VIP/作者页浏览器实测 0 控制台错误 |
| 移动端 | 390px 无页面级横向溢出 |

## 环境要求

- Node.js ≥ 20（建议 22 LTS）
- pnpm 11.x
- SQLite（默认，可切换 PostgreSQL）

## 安装

### 一键部署（推荐）

```powershell
# Windows（-Seed 写入演示数据；生产环境省略 -Seed）
powershell -ExecutionPolicy Bypass -File deploy\deploy-windows.ps1 -Seed
```

```bash
# Linux / macOS（--systemd 生成 systemd 服务并开机自启）
bash deploy/deploy-linux.sh --seed
```

停止 / 重启：`deploy/stop-windows.ps1` / `deploy/start-windows.ps1`（Linux 对应 `stop-linux.sh` / `start-linux.sh`）。
详细参数见 `docs/使用手册.md` 第 7 章。

### 手动部署

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @wmcms/api db:push
pnpm --filter @wmcms/api db:seed   # 可选：演示数据
pnpm build
pnpm --filter @wmcms/api start
pnpm --filter @wmcms/web start
```

## 演示账号

| 角色 | 账号 / 密码 |
| --- | --- |
| 超级管理员 | admin：生产随机生成，见 `apps/api/.seed-credentials.txt`（或 `SEED_ADMIN_PASSWORD`）；开发默认 `Admin@123456` |
| 内容编辑 | editor：同上（`SEED_EDITOR_PASSWORD`）；开发默认 `Editor@123456` |
| 运营专员 | operator：同上（`SEED_OPERATOR_PASSWORD`）；开发默认 `Operator@123456` |
| 读者 | alice：同上（`SEED_MEMBER_PASSWORD`）；开发默认 `Member@123456` |
| 作者 | xinghe：同上（`SEED_MEMBER_PASSWORD`）；开发默认 `Member@123456` |

> 生产环境（`NODE_ENV=production`）首次 seed 若未提供 `SEED_*_PASSWORD`，会为上述账号随机生成口令并写入 `apps/api/.seed-credentials.txt`（容器内可用 `SEED_CREDENTIALS_FILE` 指到 `/data` 卷），日志不打印口令；首个登录后请立即改密并删除该文件。「开发默认」口令仅限本地开发/演示。演示数据请在正式上线前重置；生产环境必须配置独立 JWT 密钥。

## 包内容

```
xhcms-novel-2.0.0/
├─ 使用手册.md            # 图文使用手册（Markdown）
├─ XHCMS小说站使用手册.docx # 图文使用手册（Word，含截图）
├─ README.md
├─ RELEASE_NOTES.md
├─ VERSION
├─ apps/{api,web}         # 源码（不含 node_modules/.next/dist/dev.db）
├─ packages/shared
├─ docs/                  # NOVEL_API / ARCHITECTURE / DEVELOPMENT / 使用手册
├─ screenshots/           # 界面截图（手册引用）
├─ deploy/                # 一键部署 / 停止 / 启动脚本 + Nginx 示例
└─ scripts/               # 封面生成 / 移动端检查 / 后台验收 / md→docx
```

## 已知限制

1. VIP 支付为模拟支付（订单创建 → `pay` 直接到账），接入真实支付需替换 `vip` 模块支付回调。
2. 采集为同步执行（单次默认 ≤20 章），大任务建议后续改异步队列。
3. `minimal` 主题已实现并随构建验证，种子站点使用 modern/magazine，可在后台切换查看。
4. 仪表盘“今日阅读”为章节浏览累计近似值（模型无逐日 PV 表）。
5. 旧文章模块保留在代码/数据库中但导航隐藏，小说站不使用。

## 升级/安全建议

- 生产环境设置 `NODE_ENV=production` 并提供 `JWT_SECRET` / `JWT_REFRESH_SECRET` / `JWT_MEMBER_SECRET`（一键部署脚本会自动生成随机密钥）。
- 修改默认端口、开启 HTTPS、配置反向代理与静态资源缓存（见 `deploy/nginx.conf.example`）。
- 定期备份 `apps/api/prisma/dev.db`（或迁移到 PostgreSQL 后使用数据库备份方案）。
- 不要提交 `.env`、`dev.db`、`uploads/`。
