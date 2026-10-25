# XHCMS 2.0 开发指南（并行协作约定）

> 本文件面向并行开发成员。**先读 `docs/API_CONTRACT.md`、`apps/api/prisma/schema.prisma`、
> `packages/shared/src/types.ts`，再动手写代码。**

## 0. 环境与命令（Windows + PowerShell）

PowerShell 执行策略会拦截 `pnpm.ps1`，请统一用 `cmd /c` 包装：

```powershell
cmd /c "pnpm install"                     # 安装依赖（已完成）
cmd /c "pnpm build:shared"                # 构建共享类型包（改 packages/shared 后必须执行）
cmd /c "pnpm --filter @wmcms/api build"   # 后端编译
cmd /c "pnpm --filter @wmcms/api typecheck"
cmd /c "pnpm --filter @wmcms/web build"   # 前端构建（需要先 build:shared）
cmd /c "pnpm --filter @wmcms/web typecheck"
cmd /c "pnpm db:push"                     # 同步 schema 到 SQLite（需要 prisma generate）
cmd /c "pnpm db:seed"                     # 重新生成演示数据（会清空库）
cmd /c "pnpm dev:api"                     # 启动 API: http://localhost:4000/api/v1
cmd /c "pnpm dev:web"                     # 启动 Web: http://localhost:3000
```

- 运行期端口：API `4000`，Web `3000`。
- 数据库文件：`apps/api/prisma/dev.db`。
- Swagger：`http://localhost:4000/api/docs`。
- 演示账号（seed 生成）：`admin / Admin@123456`（超管）、`editor / Editor@123456`（内容编辑）、
  `operator / Operator@123456`（运营）；门户会员 `alice / Member@123456`、作者 `xinghe / Member@123456`。
- 演示站点：`books`（星海书城，modern 主题）、`ink`（墨香书屋，magazine 主题）。
- 小说接口契约见 `docs/NOVEL_API.md`（旧 CMS 文章契约 `docs/API_CONTRACT.md` 仅历史参考）。

## 1. 文件所有权（禁止越界写入）

| 成员 | 可写范围 |
| --- | --- |
| lead | 根配置、`packages/shared/**`、`apps/api/prisma/**`、`apps/api/src/{main.ts,app.module.ts,common/**,health/**}`、`apps/web/{next.config.ts,tsconfig*,tailwind*,postcss*}`、`apps/web/src/{app/layout.tsx,app/globals.css,app/providers.tsx,lib/**,components/ui/**,components/admin/{admin-shell,admin-root,auth-guard,nav,site-switcher,theme-toggle}.tsx,app/admin/layout.tsx,app/admin/login/**}`、`docs/**` |
| api-content | `apps/api/src/modules/{sites,categories,articles,tags,media,settings,themes}/**` |
| api-identity | `apps/api/src/modules/{auth,users,roles,audit}/**` |
| api-community | `apps/api/src/modules/{members,comments,forms,plugins,dashboard}/**` |
| web-admin-content | `apps/web/src/app/admin/{articles,categories,tags,media}/**`、`apps/web/src/components/admin/{article,category,tag,media}/**` |
| web-admin-system | `apps/web/src/app/admin/{page.tsx,sites,themes,plugins,users,roles,audit-logs,settings,profile,dashboard}/**`、`apps/web/src/components/admin/{dashboard,system}/**`、`apps/web/src/app/admin/{members,comments,forms}/**`、`apps/web/src/components/admin/{member,comment,form}/**` |
| web-portal | `apps/web/src/app/(portal)/**`、`apps/web/src/components/portal/**`、`apps/web/src/themes/**` |

**共享文件（lib/api.ts、components/ui/**、admin shell、app.module.ts、common/**、schema.prisma、shared 包）只能由 Lead 修改。**
需要新增字段/接口/组件时，用 `send_message` 通知 lead，不要自行改动。

## 2. 后端开发约定（NestJS）

### 2.1 模块结构
```
modules/articles/
  articles.module.ts      # 声明 controller + service（已存在，补全 imports/controllers/providers）
  articles.controller.ts  # 管理端：@Controller('articles')
  public-articles.controller.ts  # 门户：@Controller('public/sites/:siteSlug/articles')
  articles.service.ts
  dto/create-article.dto.ts / update-article.dto.ts / query-article.dto.ts
```

### 2.2 必用内核
| 能力 | 用法 |
| --- | --- |
| 公开接口 | `@Public()`（类或方法级），否则自动要求管理员 JWT |
| 站点级接口 | `@SiteScoped()` + `@CurrentSiteId()`，缺失/越权由 `SiteAccessGuard` 拦截 |
| 权限 | `@RequirePermissions('article:create')`（需全部命中）或 `@RequireAnyPermission(...)` |
| 当前用户 | `@CurrentUser()` → `AuthContext`（含 `id/username/isSuperAdmin/permissionCodes/siteIds`） |
| 请求对象 | `@Req() req`（记审计日志用） |
| 分页 | `PageQueryDto` + `normalizePage(query)` + `paginate(items,total,page,pageSize)` |
| 内容清洗 | `sanitizeContent(html)`、`sanitizePlainText(text, max)`、`stripHtml`、`estimateReadingTime` |
| slug | `slugify(name)`、`ensureUniqueSlug(base, exists)`（同站点唯一） |
| 审计 | 注入 `AuditService`，写操作后调用 `audit.log(req, { action:'article.create', resource:'article', resourceId, detail })`，`action` 形如 `资源.动作` 全小写 |
| 插件钩子 | 注入 `PluginHostService`，`await pluginHost.runHook('chapter.beforeRender', {...})`；钩子定义见 `packages/shared/src/constants.ts` |
| 原始响应 | `@RawResponse()`（sitemap/rss 等 XML，跳过统一包装） |
| 限流 | `@Throttle({ default: { limit: 10, ttl: 60_000 } })`（登录 10/min；公开写接口 20/min） |
| 事务 | `prisma.$transaction([...])` |

### 2.3 数据约定
- Prisma 的 JSON 字段（`Site.settings`、`Form.fields`、`Plugin.config`、`FormSubmission.data`、`Category.content` 除外）
  在 SQLite 中以 **字符串** 存储：入库 `JSON.stringify(obj)`，出库 `JSON.parse(str)`（用共享的 `safeJsonParse` 风格容错）。
- Prisma `Date` 字段直接返回，Nest 会序列化为 ISO 字符串；前端类型是 `string`。
- 所有列表查询必须 `where: { siteId }`（站点级）。

### 2.4 DTO / Swagger
- 每个 DTO 用 `class-validator` 校验并写中文错误消息；
- Controller 方法加 `@ApiTags`、`@ApiOperation`、`@ApiBearerAuth('admin')`（管理端）、`@ApiHeader({ name:'X-Site-Id', required:true })`（站点级）；
- 全局 `ValidationPipe` 已开启 `whitelist/transform`，DTO 中未声明字段会被剥离。

### 2.5 返回体
- 不要手动包 `{ code, data }`：全局 `TransformInterceptor` 自动包装。
- 列表直接返回 `paginate(...)` 的结果。
- 删除类接口返回 `null`。

## 3. 前端开发约定（Next.js）

### 3.1 数据请求
```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const { data, isLoading } = useQuery({
  queryKey: ['articles', page, keyword, status],
  queryFn: () => api.articles.list({ page, pageSize: 10, keyword, status }),
});
```
- 写操作使用 `useMutation` + `queryClient.invalidateQueries({ queryKey: ['articles'] })`；
- 失败提示：`catch (e) { toast.error(e instanceof ApiError ? e.message : '操作失败'); }`；
- 站点上下文由 `tokenStorage`/store 自动注入 `X-Site-Id`，无需手动传。

### 3.2 设计系统（`@/components/ui/*`）
| 组件 | 关键 props |
| --- | --- |
| `Button` | `variant: default/secondary/outline/ghost/destructive/success/link`, `size: sm/md/lg/icon`, `loading`, `icon` |
| `Input` / `Textarea` / `Select` / `Label` / `Field` | `Field` 提供 label+error+hint 布局 |
| `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` | |
| `Badge` | `variant: default/secondary/outline/success/warning/destructive/info/purple`, `dot` |
| `Dialog` / `ConfirmDialog` | `open/onOpenChange/title/description/footer/size( sm/md/lg/xl/full )` |
| `Dropdown` | `trigger` + `items: {label,icon,onSelect,danger,separatorBefore,href}[]` |
| `Switch` | `checked/onCheckedChange` |
| `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` | 已带 `.data-table` 样式 |
| `Pagination` | `page/pageSize/total/onPageChange` |
| `EmptyState` | `icon/title/description/action` |
| `PageHeader` | `title/description/actions/eyebrow` |
| `StatCard` | `title/value/icon/hint/trend/accent` |
| `TrendChart` / `BarList` / `DonutChart` | 仪表盘图表 |
| `Tabs/TabsList/TabsTrigger/TabsContent` | 受控 tabs |
| `SearchInput` + `useDebouncedValue` | 列表搜索 |
| `Skeleton/SkeletonText/TableSkeleton/CardSkeletonGrid`、`Spinner/LoadingBlock` | 加载态 |
| `Avatar` | `src/name/size` |
| `toast` | `toast.success/error/info/warning(title, { description })` |

样式原则：只用 Tailwind 语义色（`bg-card`/`text-muted-foreground`/`border-border`/`text-primary`…），
栅格间距统一 `gap-4/gap-5`，卡片圆角用 `rounded-xl`，**不要引入新的 UI 库或 CSS-in-JS**。

### 3.3 后台页面骨架
```tsx
'use client';
export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="文章管理" description="..." actions={<Button>新建文章</Button>} />
      <Card>…</Card>
    </div>
  );
}
```
- 首页仪表盘路径是 `apps/web/src/app/admin/page.tsx`（由 web-admin-system 负责）。
- 所有后台页面必须在 `<PageHeader>` 下组织内容，表格用 `Card` 包裹。
- 表格 loading 用 `<TableSkeleton />`，空态用 `<EmptyState />`。

### 3.4 认证与站点
```tsx
const user = useAuthStore((s) => s.user);
const hasPermission = useAuthStore((s) => s.hasPermission);
const currentSite = useAuthStore((s) => s.currentSite());
```
- 路由守卫已由 `admin-root.tsx` 统一处理，页面内不要重复跳转登录。
- 需要权限控制的按钮：`{hasPermission('article:create') && <Button …/>}`。

### 3.5 门户（web-portal）
- 使用服务端组件 + `novelPortalApi`（`@/lib/server-api`）取数，默认 ISR；
- 站点解析：`Host` 头的 `site.domain` 匹配 → 否则 `NEXT_PUBLIC_DEFAULT_SITE`（默认 `books`）；`/ink` 前缀可强制切换站点；
- 页面：`/`、`/books`、`/category/[slug]`、`/book/[slug]`、`/read/[novelSlug]/[chapterNo]`、`/rank`、`/search`、`/author/[penName]`，
  会员侧 `/shelf`、`/history`、`/vip`、`/member`、`/author-center`，以及 `sitemap.xml`、`rss.xml`、`robots.txt` 的 Route Handler；
- 三套小说主题在 `apps/web/src/themes/{modern,magazine,minimal}`，`(portal)/layout.tsx` 根据 `site.themeKey` 渲染；
- 交互组件（阅读器设置、VIP 解锁、评论、会员登录、书架/充值/作者中心）放 `components/portal/{client,member,author}/**`，标注 `'use client'`；
- 章节正文为纯文本（服务端已清洗），阅读器按段落渲染，不使用 `dangerouslySetInnerHTML`。

## 6. 小说站（v2.0）速查

### 6.1 后端模块
| 模块 | 职责 |
| --- | --- |
| `modules/novels` | 书籍/分卷/章节管理、门户书库/详情/目录/阅读/排行/搜索、TXT 导入、sitemap/rss |
| `modules/reader` | 书架、阅读进度/历史、书评章评（公开+审核）、作者中心、公开作者页 |
| `modules/vip` | 钱包、充值订单（模拟支付）、章节解锁、管理端 VIP、`/dashboard/novel-stats` |
| `modules/collect` | 书源 CRUD、试采集、正式采集（cheerio HTML / JSON）、任务、演示书源 |
| `modules/{auth,users,roles,audit,sites,categories,media,settings,themes,plugins,members,comments,forms,dashboard}` | 系统能力（沿用） |
| `modules/{articles,tags}` | 旧文章模块，仅管理端保留、导航隐藏 |

### 6.2 数据一致性红线
- 章节增删改/导入/采集后：重算 `Chapter.wordCount`、`Novel.words/chapterCount/lastChapterAt`（仅统计 published）。
- 余额变更必须与 `CoinTransaction` 同事务；解锁/支付幂等（唯一约束 / 重复支付 400）。
- VIP 锁定章节禁止下发正文：`content="" + preview`，由 `vip-guard` 插件生成试读。
- 所有管理端写操作调用 `AuditService.log`；书评/章评入库前纯文本清洗。

### 6.3 前端路由归属
- 门户公共阅读：`(portal)/(default)/{page.tsx,books,book,category,read,rank,search,author}` + `[site]` 前缀同构；
- 会员/作者：`{shelf,history,vip,member,author-center}`（同一视图组件，双入口共用）；
- 后台小说域：`app/admin/{page.tsx,novels,categories,novel-comments,collect,vip,authors}`，
  系统页沿用 `sites/themes/plugins/users/roles/audit-logs/settings`。

## 4. 验收标准（每个成员交付前自检）

1. `cmd /c "pnpm build:shared"` 通过（如改过 shared 包）。
2. 后端：`cmd /c "pnpm --filter @wmcms/api build"` 与 `typecheck` 零错误；启动后 Swagger 可见自己的接口。
3. 前端：`cmd /c "pnpm --filter @wmcms/web typecheck"` 零错误；`build` 通过。
4. 接口行为与 `docs/API_CONTRACT.md` 完全一致（路径、字段名、权限、站点级、返回结构）。
5. 页面无控制台报错，加载态/空态/错误态齐全，移动端（375px）布局不溢出。
6. 完成后在共享任务中汇报：改动文件、验证命令与结果、遗留问题。

## 5. 已知环境注意事项

- pnpm 11 通过 `pnpm-workspace.yaml` 的 `allowBuilds` 控制安装脚本，不要删除。
- 本地 SQLite 并发写有限：e2e/seed 串行执行（`--runInBand`）。
- 不要提交 `.env`、`dev.db`、`uploads/`（已在 .gitignore）。
- 网络较慢，安装/构建失败先重试，不要随意删除 `node_modules` 或 pnpm store。
