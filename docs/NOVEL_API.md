# 小说站 API 契约（XHCMS Novel v1）

> 与 `docs/API_CONTRACT.md` 的通用约定一致：`/api/v1` 前缀、统一响应信封
> `{code,message,data,requestId}`、分页 `{items,total,page,pageSize}`、站点级接口带 `X-Site-Id`、
> 管理端 `Authorization: Bearer`、门户会员 token 独立签名。
>
> 类型定义见 `packages/shared/src/types.ts`（NovelCard / NovelDetail / ChapterContent / WalletInfo …）。

## 1. 权限码（管理端）

| 资源 | 权限码 |
| --- | --- |
| 书籍 | `novel:view/create/update/delete/review` |
| 章节 | `chapter:view/create/update/delete` |
| 采集 | `collect:view/create/update/delete/run` |
| VIP | `vip:view`（订单/解锁/流水）、`vip:credit`（调整书币） |
| 作者 | `author:view/review` |
| 分类 | 复用 `category:*` |
| 评论 | 复用 `comment:view/update/delete`（书评/章评） |
| 仪表盘 | `dashboard:view` |

## 2. 门户公开接口（`@Public`，站点由路径 `:slug` 指定）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/public/sites/:slug/novel-categories` | 小说分类树（仅 enabled，`PublicCategory[]` 结构） |
| GET | `/public/sites/:slug/novels` | 书库列表：`page,pageSize,categorySlug,status,keyword,sortBy=updatedAt\|createdAt\|views\|favorites\|words,order,isRecommend,isTop` → `Paginated<NovelCard>`；仅 `auditStatus=published` |
| GET | `/public/sites/:slug/novels/:novelSlug` | `NovelDetail`（分卷目录、首章/最新章节、commentCount；可选会员 token → `inBookshelf/progress/unlockedChapterIds`） |
| GET | `/public/sites/:slug/novels/:novelSlug/catalog` | `NovelCatalog`（全部分卷与章节摘要） |
| GET | `/public/sites/:slug/novels/:novelSlug/chapters/:chapterNo` | `ChapterContent`；可选会员 token。**VIP 章节未解锁时 `locked=true`、`content=""`、`preview` 为试读**（由 `vip-guard` 插件按比例生成） |
| GET | `/public/sites/:slug/rankings?type=hot\|new\|favorite\|words&limit=20` | 排行榜 → `NovelCard[]` |
| GET | `/public/sites/:slug/search?q&page&pageSize` | 搜索书名/作者 → `Paginated<NovelCard>` |
| GET | `/public/sites/:slug/authors/:penName` | 作者主页 `{penName,bio,stats,novels:NovelCard[]}` |
| GET | `/public/sites/:slug/novel-comments?novelId=&chapterId=&page&pageSize` | 已审核书评/章评树 `PublicNovelComment[]` |
| POST | `/public/sites/:slug/novel-comments` | `{novelId, chapterId?, parentId?, content}`；可选会员 token；20/min；返回 `{id,status}` |
| GET | `/public/sites/:slug/sitemap.xml` | 书籍/章节/分类/排行/作者 URL（`@RawResponse`） |
| GET | `/public/sites/:slug/rss.xml` | 最新章节 RSS（`@RawResponse`） |

### 章节访问与试读规则
1. `chapter.status` 必须为 `published`，否则 404。
2. 需要付费：`novel.vipOnly = true` 或 `chapter.isVip = true`（且 `price > 0`）。
3. 已解锁条件：存在 `ChapterUnlock(memberId, chapterId)`；或请求者是本书作者；或章节免费。
4. 未登录/未解锁：返回 `locked=true, content="", preview=插件生成试读, balance=null`；`chapter.views` 仍 +1。
5. 已解锁：返回完整 `content`、`locked=false`、`unlocked=true`、`balance=钱包余额`。
6. 阅读接口必须写入 `ReadingProgress`（已登录会员，含 `percent` 由前端每 20% 上报一次）；`novel.views/chapter.views` +1。

## 3. 会员接口（`@Public` + `MemberAuthGuard`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/public/sites/:slug/members/bookshelf` | 书架：GET → `BookshelfItem[]`；POST `{novelId}` → `{added:true}`（幂等） |
| DELETE | `/public/sites/:slug/members/bookshelf/:novelId` | 移出书架 |
| GET | `/public/sites/:slug/members/history?page&pageSize` | 阅读历史 `Paginated<ReadingHistoryItem>`（按 updatedAt desc） |
| PUT | `/public/sites/:slug/members/progress` | `{novelId, chapterId, percent}` → `null` |
| GET | `/public/sites/:slug/members/wallet` | `WalletInfo{balance,totalRecharged,totalConsumed}`（不存在自动创建 0 余额钱包） |
| GET | `/public/sites/:slug/members/transactions?page` | 书币流水 `Paginated<CoinTransactionItem>` |
| GET | `/public/sites/:slug/members/orders?page` | 充值订单 `Paginated<RechargeOrder>` |
| POST | `/public/sites/:slug/members/orders` | `{planId}`（取值见 `RECHARGE_PLANS`）→ `RechargeOrder(status=pending)` |
| POST | `/public/sites/:slug/members/orders/:orderNo/pay` | 模拟支付：置 paid、按套餐加币（含赠送）、写流水 → `{order,balance}`；重复支付 400 |
| POST | `/public/sites/:slug/members/chapters/:chapterId/unlock` | 解锁章节：余额不足 400「书币不足」；已解锁幂等；成功扣币 + `ChapterUnlock` + 流水 → `UnlockChapterResult` |
| GET/POST | `/public/sites/:slug/members/author` | GET → `AuthorProfile \| null`；POST 申请 `{penName,bio,contact}`（重复申请 409） |
| GET | `/public/sites/:slug/members/author/stats` | 作者数据 `AuthorStats` |
| GET/POST | `/public/sites/:slug/members/author/novels` | 我的作品：GET `Paginated<AuthorNovelItem>`；POST 创建（`auditStatus=pending`，`authorId=当前会员`） |
| PATCH/DELETE | `/public/sites/:slug/members/author/novels/:id` | 仅限本人作品；上架中的书籍修改后保持上架 |
| GET/POST | `/public/sites/:slug/members/author/novels/:id/chapters` | 章节列表/新建（新建后自动重算字数与章节数；书籍未上架时章节为 draft） |
| PATCH/DELETE | `/public/sites/:slug/members/author/novels/:id/chapters/:chapterId` | 仅限本人作品章节 |

**作者规则**：只有 `AuthorProfile.status='approved'` 的会员可创建作品；创建作品 `auditStatus=pending` 等待管理员审核；
作者可编辑自己作品的书籍信息与章节；管理员可随时下架（`offline`）。

## 4. 管理端接口（管理员 JWT + 站点级）

### 4.1 书籍 / 分卷 / 章节
| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/novels` | `novel:view`（`page,pageSize,keyword,categoryId,status,auditStatus,isRecommend,sortBy,order`） |
| GET | `/novels/:id` | `novel:view` |
| POST | `/novels` | `novel:create` |
| PATCH | `/novels/:id` | `novel:update` |
| DELETE | `/novels/:id` | `novel:delete`（级联删除章节/评论/书架/进度） |
| POST | `/novels/:id/review` | `novel:review`：`{auditStatus:'published'\|'rejected'\|'offline', reason?}` |
| POST | `/novels/batch` | 按 action 校验：`{ids, action:'publish'\|'offline'\|'recommend'\|'unrecommend'\|'delete'}` → `{affected}` |
| GET/POST | `/novels/:id/volumes` | `novel:view` / `novel:update`（`{title,sort}`） |
| PATCH/DELETE | `/volumes/:id` | `novel:update` |
| GET | `/chapters?novelId&keyword&status&page&pageSize` | `chapter:view` |
| GET | `/chapters/:id` | `chapter:view`（含完整 content） |
| POST | `/chapters` | `chapter:create`：`{novelId,title,content,volumeId?,isVip?,price?,status?}`；`chapterNo` 自动取 max+1 |
| PATCH | `/chapters/:id` | `chapter:update` |
| DELETE | `/chapters/:id` | `chapter:delete` |
| POST | `/chapters/:id/publish` / `/unpublish` | `chapter:update` |
| POST | `/novels/:id/import-txt` | `chapter:create`：multipart `file` + 字段 `volumeTitle?`、`pattern?`（默认 `^第[一二三四五六七八九十百千0-9]+[章节回]`）；自动分章、清洗空行 → `TxtImportResult` |

### 4.2 采集中心
| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET/POST | `/book-sources` | `collect:view` / `collect:create` |
| PATCH/DELETE | `/book-sources/:id` | `collect:update` / `collect:delete` |
| POST | `/book-sources/:id/test` | `collect:run`：抓取 `bookUrl`（缺省 baseUrl）并返回 `{book:{title,author,cover,summary},chapters:[{title}] (最多 5 条)}`，不落库 |
| POST | `/collect/run` | `collect:run`：`{sourceId, bookUrl?, novelId?, limit?}`；有 `novelId` 表示向已有书籍追加章节，否则新建书籍（作者名为来源作者或「采集」）→ `CollectTask` |
| GET | `/collect/tasks` | `collect:view` 分页，含 `sourceName/novelTitle` |
| GET | `/collect/tasks/:id` | `collect:view` |

**书源类型**：
- `html`：`selectors = {bookTitle,bookAuthor,bookCover,bookSummary,chapterLinks,chapterTitle,chapterContent,linkPrefix?}`（CSS 选择器，使用 cheerio 解析）；
- `json`：`selectors = {listPath,itemsPath,titlePath,contentPath}`（点号路径，如 `data.chapters`）。
- 采集必须限速（每章间隔 ≥300ms）、去重（同书名同作者不重复建书；章节标题已存在则跳过）、失败项计入 `failed` 并记录 `message`。

### 4.3 VIP / 作者 / 评论 / 仪表盘
| 方法 | 路径 | 权限 |
| --- | --- | --- |
| GET | `/vip/orders?page&status&keyword` | `vip:view` |
| GET | `/vip/unlocks?page&memberId&novelId` | `vip:view` |
| GET | `/vip/transactions?page&type&memberId` | `vip:view` |
| POST | `/vip/credit` | `vip:credit`：`{memberId, amount, remark}`（正负均可，余额不得为负）→ `{balance}` |
| GET | `/author-applications?status&page` | `author:view` |
| POST | `/author-applications/:id/review` | `author:review`：`{status:'approved'\|'rejected', reason?}` |
| GET | `/novel-comments?status&novelId&chapterId&page` | `comment:view`（含 novel/chapter 标题） |
| PATCH | `/novel-comments/:id/status` | `comment:update`：`{status:'approved'\|'rejected'}` |
| DELETE | `/novel-comments/:id` | `comment:delete` |
| GET | `/dashboard/novel-stats` | `dashboard:view`：`NovelDashboardStats` |

**分类**：沿用 `/categories` 接口，新增 `type=novel` 取值；`Category.articleCount` 在小说站点表示「本分类书籍数」（字段名保持不变以兼容旧前端，前端标注为「书籍数」）。

## 5. 数据一致性要求

- `Novel.slug` 站点内唯一；`Chapter.chapterNo` 书籍内唯一（新增取 max+1）。
- 章节新增/更新/删除后：重算 `Chapter.wordCount`（中文字符+英文单词）、`Novel.words`、`Novel.chapterCount`、
  `Novel.lastChapterAt`、`Novel.updatedAt`；书籍 `publishedAt` 在首次上架时写入。
- VIP：`chapter.isVip=true` 时 `price` 必须 ≥1（默认 `CHAPTER_DEFAULT_PRICE=20`）；作者/管理员编辑不受限。
- 余额与流水：所有余额变更必须写 `CoinTransaction`（`amount` 正负、`balance` 变更后余额），并在同一事务内更新 `Wallet`。
- 审计：所有管理端写操作写 `AuditLog`（`novel.create/update/delete/review`、`chapter.*`、`vip.credit`、`collect.run` …）。
- 内容安全：书评/章评入库前 `sanitizePlainText`；采集正文做 HTML→纯文本转换（去标签、合并空行）。
