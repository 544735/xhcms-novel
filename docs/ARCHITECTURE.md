# XHCMS Novel 2.0 架构说明

## 1. 定位

XHCMS Novel 2.0 是对传统 .NET 版 XHCMS 的**彻底现代化重构**，并将内容域落地为**小说网站**：
在保留多站点 / 会员 / 评论 / 主题 / 插件 / RBAC 底座的前提下，用
**书籍 · 分卷 · 章节 · 阅读器 · VIP 付费 · 作者中心 · 采集** 替换原有文章模型。
TypeScript 全栈重写，前后端共享一套类型契约。

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  apps/web (Next.js 15)      │  HTTP   │  apps/api (NestJS 11)        │
│  ├─ /admin/*  管理后台 SPA   │ ──────► │  ├─ 全局守卫：JWT/RBAC/站点  │
│  ├─ (portal)  书库/阅读器 SSR│  JSON   │  ├─ 业务模块（小说域 + 系统） │
│  └─ 3 套小说主题             │         │  ├─ 插件宿主（钩子广播）      │
└──────────────┬──────────────┘         │  └─ Prisma ORM               │
               │                        └──────────────┬───────────────┘
               │                                       │
        ┌──────▼───────────────────────────────────────▼──────┐
        │  packages/shared：类型 / 权限码 / 插件清单 / 主题清单 │
        └─────────────────────────────────────────────────────┘
                                       │
                               ┌───────▼────────┐
                               │ SQLite (dev.db)│  ← 可平滑切换 PostgreSQL
                               └────────────────┘
```

## 2. 技术选型

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 后端框架 | NestJS 11 | 模块化、DI、守卫/拦截器生态成熟，适合 CMS 这类多模块系统 |
| ORM | Prisma 6 + SQLite | 类型安全、迁移简单；开发零依赖，生产可切 PostgreSQL |
| 鉴权 | JWT（access 15m / refresh 7d）+ RBAC | 权限每次请求从 DB 解析并短缓存，改权即时生效 |
| 内容安全 | sanitize-html / 纯文本清洗 | 旧文章富文本白名单；小说章节/书评入库前统一转纯文本 |
| 采集 | cheerio + iconv-lite | HTML CSS 选择器 / JSON 路径解析，GBK 自动识别 |
| 前端框架 | Next.js 15 App Router | 后台 SPA + 门户 SSR/ISR 共用一套工程 |
| 状态/数据 | TanStack Query + Zustand | 服务端状态与客户端会话状态分离 |
| 样式 | Tailwind CSS 3 + CSS 变量 | Design Token 驱动，支持暗色模式与主题品牌色 |
| 富文本 | TipTap 2 | 可扩展、输出可控 HTML |
| 契约 | `@wmcms/shared` | 前后端同一份 TS 类型，杜绝字段漂移 |

## 3. 关键设计

### 3.1 多站点隔离
- 所有内容表携带 `siteId`；管理端站点级接口必须带 `X-Site-Id`。
- `SiteAccessGuard` 校验当前用户是否被授权该站点（超管直通），实现"平台管理员 / 站点运营"两种形态。
- 前端 `SiteSwitcher` 切换站点后清空查询缓存并刷新，避免跨站数据残留。

### 3.2 RBAC
- 权限点 `资源:动作`（如 `article:publish`）唯一定义于 `packages/shared/src/permissions.ts`。
- 用户 → 角色（多对多）→ 权限；`RbacGuard` 通过 `AuthContextService` 读取并缓存 30 秒。
- 控制器用 `@RequirePermissions('article:create')` 声明，未声明则仅要求登录。

### 3.3 插件机制
- 插件 = 数据库记录（启停/配置）+ 代码实现（`common/plugins/builtin/*`）。
- 小说站钩子：`novel.beforeCreate`、`chapter.beforeRender`、`chapter.afterPublish`、`comment.beforeCreate`、
  `comment.afterCreate`、`public.sitemap`、`dashboard.afterStats`（旧文章钩子保留兼容但已无内置实现）。
- 内置插件：章节统计（字数/阅读时长）、VIP 试读（按比例生成 preview）、书籍 SEO（自动简介 + 运营洞察）、
  评论卫士、Sitemap 增强（分类/排行/作者 URL）。
- `PluginHostService.runHook()` 顺序执行启用插件的处理器，浅合并返回对象；单个插件异常仅告警，不影响主流程。
- 管理端切换开关后调用 `reload()` 热生效，无需重启。

### 3.4 主题模板
- 三套内置小说主题：`modern` 星海夜读（渐变色卡）、`magazine` 墨香书卷（纸感/衬线）、`minimal` 极简纯读。
- 站点通过 `themeKey` 选择；主题配置（品牌色、布局开关）存于站点 settings。
- 门户服务端渲染时按主题选择 `Header/Footer/Hero/BookCard/BookGrid/BookDetail` 布局组件，同一套数据驱动不同视觉；
  阅读器使用主题声明的 `readerSkin`（背景/文字色）。

### 3.5 章节阅读链路（VIP 与试读）
```
GET /public/sites/:slug/novels/:novelSlug/chapters/:chapterNo
  → 校验章节 published
  → 会员可选身份（OptionalMemberAuthGuard）
  → 判定 needPay = price>0 && (chapter.isVip || novel.vipOnly)
     已解锁 = ChapterUnlock 存在 | 本书作者 | 免费
  → pluginHost.runHook('chapter.beforeRender')
       ├─ chapter-stats：wordCount / readingTime
       └─ vip-guard：未解锁时生成 preview（比例 25% + 最小 400 字）
  → 未解锁：content="" + preview + balance=null（禁止把正文下发）
     已解锁：完整正文 + balance
  → ReadingProgress upsert + chapter.views / novel.views +1
  → Next.js 阅读器 SSR，客户端负责字号/背景/进度上报/解锁后二次拉取
```

### 3.6 资金与解锁一致性
- `Wallet.balance` 与 `CoinTransaction` 必须同事务更新；`ChapterUnlock(memberId, chapterId)` 唯一约束保证幂等。
- 订单：创建 pending → `/pay` 模拟支付事务内置 paid + 加币（含赠送）+ 流水；重复支付 400。
- 解锁：事务内校验余额/已解锁/免费/作者本人；余额不足返回 400「书币不足」。

### 3.8 安全基线
- 签名密钥只从环境变量读取；生产缺失即拒绝启动，开发环境生成进程内随机密钥（重启失效）；管理员与会员使用独立密钥。
- 登录/公开写接口限流；密码 bcrypt(cost=10)；章节/书评入库前统一纯文本清洗。
- 防越权：所有写操作先校验权限码 + 站点授权；会员接口校验 `member.siteId`；审计日志记录 IP / UA / 操作对象。
- 采集仅允许 http/https（拒绝云元数据地址）、15s 超时、8MB 响应上限、每章 ≥300ms 限速。

## 4. 数据模型（核心关系）

```
Site 1─* Novel *─1 Category（type=novel）      Novel 1─* Volume 1─* Chapter
Novel *─1 Member（作者，可选）                  Novel 1─* Bookshelf / ReadingProgress / NovelComment
Member 1─1 Wallet 1─* CoinTransaction          Member 1─* Order / ChapterUnlock
Member 1─0..1 AuthorProfile（作者申请）         Chapter 1─* ChapterUnlock
Site 1─* BookSource 1─* CollectTask
User *─* Role *─* Permission                    User *─* Site（站点授权）
Plugin / Theme / AuditLog
```

旧文章模型（`Article` / `Tag` / `ArticleTag` / 文章 `Comment` / `Form`）保留在库中但导航隐藏，小说站不再使用。
字段定义见 `apps/api/prisma/schema.prisma`，类型契约见 `packages/shared/src/types.ts`，
小说接口契约见 `docs/NOVEL_API.md`（旧 CMS 契约见 `docs/API_CONTRACT.md`）。

## 5. 目录职责

```
apps/api/src/common/     全局内核：Prisma / 守卫 / 过滤器 / 拦截器 / 插件宿主 / 工具
apps/api/src/modules/    业务模块：novels / reader / vip / collect + 系统模块
apps/api/prisma/         schema 与小说站种子数据
apps/web/src/app/admin/  管理后台路由（小说域）
apps/web/src/app/(portal)/ 门户路由（书库 / 详情 / 阅读器 / 排行 / 搜索 / 作者 / 会员 / VIP / 作者中心）
apps/web/src/components/ui/ 设计系统组件
apps/web/src/components/admin/ 后台壳层与小说业务组件
apps/web/src/components/portal/ 门户主题视图（server）与交互组件（client）
apps/web/src/themes/     三套小说主题
packages/shared/         前后端共享类型与常量（主题/套餐/插件清单）
```
