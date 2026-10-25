# XHCMS 2.0 API 契约（唯一事实来源）

> 所有后端实现与前端调用必须严格遵守本文件。字段名/路径/权限码如需变更，必须先改本文件与
> `packages/shared/src/types.ts`，再通知全体成员。

## 1. 全局约定

- **Base URL**：`http://localhost:4000/api/v1`
- **门户前台**通过 Next.js 服务端渲染消费同一套 `/public/*` 接口（内部地址 `API_INTERNAL_URL`）。
- **响应包装**（`TransformInterceptor` 全局生效）：

```json
{ "code": 0, "message": "ok", "data": <payload>, "requestId": "uuid" }
```

- **错误响应**（`AllExceptionsFilter` 全局生效，HTTP 状态码保留）：

```json
{ "code": 404, "message": "文章不存在", "errors": ["可选字段错误"], "requestId": "uuid", "path": "/api/v1/articles/x", "timestamp": "ISO" }
```

- **分页**：`data = { items: T[], total: number, page: number, pageSize: number }`
  查询参数：`page`（默认 1，≥1）、`pageSize`（默认 10，1..100）、`keyword`（可选模糊搜索）。
- **时间**：一律 ISO-8601 字符串（`new Date().toISOString()`）。
- **ID**：cuid 字符串。
- **站点上下文**：管理端「站点级」接口必须带请求头 `X-Site-Id: <siteId>`。
  - 缺失 → `400 { message: "缺少站点上下文 X-Site-Id" }`
  - 当前用户不是超管且未被授权该站点 → `403 { message: "无权访问该站点" }`
- **鉴权**：`Authorization: Bearer <accessToken>`（管理端 15 分钟有效）；`refreshToken` 7 天。
- **标签/栏目选择器**等下拉接口统一返回精简对象（见各节）。
- **原始响应**：`sitemap.xml` / `rss.xml` 使用 `@RawResponse()` 跳过包装，直接返回 XML/字符串。
- **内容安全**：文章正文、栏目页正文、评论内容入库前必须经 `sanitize-html` 白名单清洗
  （允许标签：`p,br,strong,em,u,s,h1..h4,ul,ol,li,blockquote,pre,code,a,img,figure,figcaption,table,thead,tbody,tr,th,td,hr,span`；
  属性：`a[href,title,target,rel]`、`img[src,alt,width,height]`、`*[class]`）。
- **限流**：登录 10 次/分钟，公开写接口（评论/表单/注册）20 次/分钟，其余 300 次/分钟。

## 2. 权限码表

权限点唯一定义于 `packages/shared/src/permissions.ts`（`PERMISSION_GROUPS`）。
格式 `资源:动作`。管理员 JWT 中**不**携带权限，`RbacGuard` 每次请求从 DB 解析（30s 内存缓存）。

内置角色：`super_admin`（全部）、`editor`（内容）、`operator`（运营）、`auditor`（只读）。

## 3. 认证 / 账号

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/auth/login` | 公开 | body `{username,password}` → `LoginResult` |
| POST | `/auth/refresh` | 公开 | body `{refreshToken}` → `RefreshResult` |
| GET | `/auth/profile` | 登录 | → `UserProfile` |
| PATCH | `/auth/password` | 登录 | body `{oldPassword,newPassword}` → `null` |
| POST | `/auth/logout` | 登录 | → `null` |

`LoginResult = { accessToken, refreshToken, user: UserProfile }`
`UserProfile` 见 shared types（含 `permissions: string[]`、`sites: SiteSummary[]`、`isSuperAdmin`）。

## 4. 仪表盘

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/dashboard/stats` | `dashboard:view` | 站点级（X-Site-Id），→ `DashboardStats` |

`trend` 固定返回最近 7 天；`system.pluginsEnabled` 为启用插件数。

## 5. 站点 / 主题

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/sites` | `site:view` | 分页，query `status` → `Paginated<Site>` |
| GET | `/sites/options` | 登录 | → `SiteSummary[]`（当前用户可访问站点） |
| GET | `/sites/:id` | `site:view` | → `Site` |
| POST | `/sites` | `site:create` | body `SiteInput` → `Site` |
| PATCH | `/sites/:id` | `site:update` | body `Partial<SiteInput>` → `Site` |
| DELETE | `/sites/:id` | `site:delete` | → `null`（站点下有文章时返回 400） |
| GET | `/themes` | `theme:view` | → `Theme[]`（含 `activeSites` 使用数） |
| POST | `/themes/activate` | `theme:update` | body `{siteId, themeKey}` → `Site` |

`SiteInput = {name, slug, domain?, themeKey?, logo?, description?, seoTitle?, seoKeywords?, seoDescription?, status?, settings?}`

## 6. 栏目

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/categories` | `category:view` |
| GET | `/categories/tree` | `category:view` |
| GET | `/categories/:id` | `category:view` |
| POST | `/categories` | `category:create` |
| PATCH | `/categories/:id` | `category:update` |
| DELETE | `/categories/:id` | `category:delete` |

- 站点级（X-Site-Id）。`GET /categories` query：`type`、`status` → `Category[]`（扁平，含 `articleCount`）。
- `GET /categories/tree` → `CategoryNode[]`（嵌套）。
- DELETE 时若存在子栏目或文章 → `400 { message: "该栏目下存在子栏目或文章，无法删除" }`。
- `CategoryInput = {parentId?, name, slug?, type?, description?, icon?, sort?, status?, seoTitle?, seoKeywords?, seoDescription?, content?, template?}`
- `slug` 缺省由 `name` 生成拼音式 slug（`slugify`：小写、非字母数字转 `-`、中文转 `post-<random4>`）。

## 7. 文章 / 标签

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/articles` | `article:view` |
| GET | `/articles/:id` | `article:view` |
| POST | `/articles` | `article:create` |
| PATCH | `/articles/:id` | `article:update` |
| DELETE | `/articles/:id` | `article:delete` |
| POST | `/articles/:id/publish` | `article:publish` | 无请求体；`publishedAt` 缺省取当前时间 |
| POST | `/articles/:id/unpublish` | `article:publish` |
| POST | `/articles/batch` | 按 action 校验（publish/delete 等） |
| GET | `/tags` | `tag:view` |
| GET | `/tags/options` | `tag:view` |
| POST | `/tags` | `tag:create` |
| PATCH | `/tags/:id` | `tag:update` |
| DELETE | `/tags/:id` | `tag:delete` |

- 站点级。`GET /articles` query：`categoryId,tagId,status,isTop,isRecommend,authorId,sortBy,order,page,pageSize,keyword`
  → `Paginated<ArticleListItem>`（不含 content，含 category/tags/authorName）。
- `GET /articles/:id` → `Article`（含 content）。
- `POST /articles` body `ArticleInput`；`tagIds` 全量替换关联。`slug` 在同站点唯一，缺省自动生成。
- `status=published` 且未提供 `publishedAt` → 置为当前时间；`status=draft` 时清空？**保留** publishedAt 不写。
- `POST /articles/batch` body `{ids: string[], action: ArticleBatchAction}` → `{affected: number}`。
- `GET /tags` 分页，`keyword` 模糊；→ `Paginated<Tag>`（含 articleCount）。
- `GET /tags/options` → `Tag[]`（当前站点全部，供选择器）。
- `TagInput = {name, slug?}`。

## 8. 媒体库

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/media` | `media:view` |
| POST | `/media/upload` | `media:upload` |
| DELETE | `/media/:id` | `media:delete` |
| POST | `/media/batch-delete` | `media:delete` |

- 站点级。`GET /media` query：`mimeType`、`folder` → `Paginated<Media>`。
- 上传：`multipart/form-data`，字段 `file`（必填）、`siteId`（必填）、`folder?`。
  校验类型 `UPLOAD_ALLOWED_MIME`、大小 ≤ 10MB；图片用 `sharp` 读取宽高；文件落盘
  `apps/api/uploads/<siteId>/<yyyyMM>/<uuid>.<ext>`，`url = /uploads/<...>`（`ServeStaticModule` 暴露）。
- 删除同时删除磁盘文件（文件不存在时忽略）。

## 9. 管理员 / 角色 / 权限 / 日志

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/users` | `user:view` |
| GET | `/users/:id` | `user:view` |
| POST | `/users` | `user:create` |
| PATCH | `/users/:id` | `user:update` |
| DELETE | `/users/:id` | `user:delete` |
| PATCH | `/users/:id/status` | `user:update` |
| GET | `/roles` | `role:view` |
| GET | `/roles/options` | 登录 |
| GET | `/roles/:id` | `role:view` |
| POST | `/roles` | `role:create` |
| PATCH | `/roles/:id` | `role:update` |
| DELETE | `/roles/:id` | `role:delete` |
| GET | `/permissions` | 登录 |
| GET | `/audit-logs` | `audit:view` |

- `GET /users` → `Paginated<AdminUser>`；`AdminUser` 含 `roleIds/siteIds/roles/permissions`。
- `UserInput = {username, email, password?, nickname?, avatar?, status?, isSuperAdmin?, roleIds?: string[], siteIds?: string[]}`
  创建时 password 必填（≥8 位）；更新时 password 可选（传则重置）。
- 不可删除/禁用自己；不可删除最后一个超管；`super_admin` 角色仅超管可分配。
- `GET /roles` → `Paginated<Role>`；`GET /roles/options` → `RoleSummary[]`。
- `RoleInput = {name, code, description?, permissionCodes: string[]}`（code 唯一，创建后不可改）。
- `GET /permissions` → `PermissionGroup[]`。
- `GET /audit-logs` query `userId,action,resource,from,to` → `Paginated<AuditLog>`。
- 所有写操作（POST/PATCH/DELETE）必须写 `AuditLog`：`action` 如 `article.create`，`resource` 为资源名，
  `resourceId` 为目标 ID，`detail` 为 JSON 字符串（可含变更摘要），`ip/userAgent` 取自请求。

## 10. 会员 / 评论 / 表单（管理端）

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/members` | `member:view` |
| GET | `/members/:id` | `member:view` |
| POST | `/members` | `member:create` |
| PATCH | `/members/:id` | `member:update` |
| DELETE | `/members/:id` | `member:delete` |
| PATCH | `/members/:id/status` | `member:update` |
| POST | `/members/:id/reset-password` | `member:update` |
| GET | `/comments` | `comment:view` |
| PATCH | `/comments/:id/status` | `comment:update` |
| DELETE | `/comments/:id` | `comment:delete` |
| POST | `/comments/batch` | 按 action 校验 |
| GET | `/forms` | `form:view` |
| GET | `/forms/:id` | `form:view` |
| POST | `/forms` | `form:create` |
| PATCH | `/forms/:id` | `form:update` |
| DELETE | `/forms/:id` | `form:delete` |
| GET | `/forms/:id/submissions` | `form:view` |
| PATCH | `/forms/submissions/:id/read` | `form:update` |
| DELETE | `/forms/submissions/:id` | `form:delete` |

- 会员/评论/表单均站点级。
- `MemberInput = {username, email, password?, nickname?, avatar?, status?, points?}`。
- `PATCH /comments/:id/status` body `{status: 'approved'|'rejected'}` → `Comment`。
- `POST /comments/batch` body `{ids, action: 'approve'|'reject'|'delete'}` → `{affected}`。
- `FormInput = {name, slug?, description?, fields: FormField[], status?, successMessage?}`；`fields` 存 JSON。
- 提交列表 `Paginated<FormSubmission>`（`data` 已 parse 成对象）。

## 11. 设置 / 插件

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/settings` | `setting:view` |
| PUT | `/settings` | `setting:update` |
| GET | `/plugins` | `plugin:view` |
| GET | `/plugins/:key` | `plugin:view` |
| PATCH | `/plugins/:key` | `plugin:update` |

- `GET /settings` query `siteId?`；返回 `SettingsMap`（`{[group]: {key: value}}`）。
  `siteId` 缺省时返回全局设置（`siteId=null`）。
- `PUT /settings` body `{siteId?: string|null, items: SettingItem[]}` → `SettingsMap`；upsert。
- `PATCH /plugins/:key` body `{enabled?: boolean, config?: Record<string, unknown>}` → `Plugin`；启用后立即热生效。

## 12. 门户（Public，无需鉴权）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/public/sites/:slug` | → `PublicSite` |
| GET | `/public/sites/:slug/theme` | → `PublicThemePayload` |
| GET | `/public/sites/:slug/categories` | query `type?` → `PublicCategory[]`（嵌套，仅 enabled） |
| GET | `/public/sites/:slug/articles` | `PublicSiteQuery` → `Paginated<PublicArticleCard>` |
| GET | `/public/sites/:slug/articles/:slug` | → `PublicArticleDetail`（正文已清洗 + 插件增强；`views` +1） |
| GET | `/public/sites/:slug/articles/:slug/comments` | → `PublicComment[]`（仅 approved，树形） |
| POST | `/public/sites/:slug/articles/:slug/comments` | body `{nickname, email?, content, parentId?}`，可选会员 `Authorization` |
| GET | `/public/sites/:slug/tags` | → `Tag[]`（含 articleCount） |
| GET | `/public/sites/:slug/archive` | → `PublicArchiveGroup[]` |
| GET | `/public/sites/:slug/pages/:slug` | → `PublicPage`（page 类型栏目正文） |
| GET | `/public/sites/:slug/search` | query `q,page,pageSize` → `Paginated<PublicArticleCard>` |
| POST | `/public/sites/:slug/forms/:formSlug/submissions` | body `Record<string, unknown>` → `{ok: true}` |
| GET | `/public/sites/:slug/sitemap.xml` | `@RawResponse`，`application/xml`，含插件追加 URL |
| GET | `/public/sites/:slug/rss.xml` | `@RawResponse`，`application/rss+xml`，最近 20 篇 |

- **注册/登录（会员）**：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/public/sites/:slug/members/register` | `{username,email,password,nickname?}` → `{member, token}` |
| POST | `/public/sites/:slug/members/login` | `{account,password}` → `{member, token}` |
| GET | `/public/sites/:slug/members/profile` | Bearer 会员 token → `PublicMember` |
| GET | `/public/sites/:slug/members/comments` | Bearer 会员 token → `Paginated<Comment>` |
| PATCH | `/public/sites/:slug/members/profile` | `{nickname?,avatar?,password?}` → `PublicMember` |

会员 token 载荷：`{sub, type:'member', siteId, username}`，有效期 7 天。
评论/表单接口对**未登录**开放；带会员 token 时评论绑定 `memberId` 并取昵称。

**插件钩子（Public 渲染链路必须调用）**：
`article.beforeRender` → 返回 `{content, readingTime, toc}` 增强（reading-time / auto-toc 插件实现）；
`sitemap` → `public.sitemap` 钩子追加 URL；`comment.beforeCreate` → 返回 `{blocked, reason}`；
`dashboard.afterStats` → 附加 `insights`。

**错误约定（Public 写接口）**：评论被插件拦截 → `400 { message: "评论包含违规内容，已被安全策略拦截" }`；
重复提交同一 IP 60 秒内 → `429 { message: "提交过于频繁，请稍后再试" }`。

## 13. 健康检查

`GET /api/v1/health` → `{status:'ok', uptime, timestamp, version}`（公开，不包装？——统一包装，data 为上述对象）。
