/**
 * XHCMS 2.0 共享类型契约。
 * 后端 (NestJS) 与前端 (Next.js) 共同依赖本文件，任何字段变更都必须先改这里。
 */

/* ------------------------------------------------------------------ */
/* 通用响应 / 分页                                                      */
/* ------------------------------------------------------------------ */

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

export interface ApiErrorPayload {
  code: number;
  message: string;
  errors?: string[];
  requestId: string;
  path?: string;
  timestamp?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export type SortOrder = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/* 基础枚举                                                            */
/* ------------------------------------------------------------------ */

export type SiteStatus = 'enabled' | 'disabled';
export type UserStatus = 'active' | 'disabled';
export type MemberStatus = 'active' | 'disabled';
export type CategoryType = 'article' | 'page' | 'novel';
export type EntityStatus = 'enabled' | 'disabled';
export type ArticleStatus = 'draft' | 'published' | 'scheduled' | 'archived';
export type CommentStatus = 'pending' | 'approved' | 'rejected';
export type FormStatus = 'enabled' | 'disabled';
export type ThemeKey = 'modern' | 'magazine' | 'minimal';

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  scheduled: '定时发布',
  archived: '已归档',
};

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
};

/* ------------------------------------------------------------------ */
/* 站点 / 主题                                                          */
/* ------------------------------------------------------------------ */

export interface SiteSettings {
  /** 主题品牌色 */
  primaryColor?: string;
  /** 首页模块开关 */
  homeModules?: string[];
  /** 备案号 */
  icp?: string;
  /** 版权信息 */
  copyright?: string;
  /** 每页条数 */
  pageSize?: number;
  /** 评论是否需要审核 */
  commentAudit?: boolean;
  [key: string]: unknown;
}

export interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  themeKey: string;
  logo: string | null;
  description: string | null;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  status: SiteStatus;
  settings: SiteSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSummary {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  themeKey: string;
  status: SiteStatus;
}

export interface Theme {
  key: string;
  name: string;
  description: string;
  preview: string | null;
  builtin: boolean;
  config: Record<string, unknown> | null;
  sort: number;
  activeSites: number;
}

/* ------------------------------------------------------------------ */
/* 用户 / 角色 / 权限                                                   */
/* ------------------------------------------------------------------ */

export interface RoleSummary {
  id: string;
  name: string;
  code: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  nickname: string | null;
  avatar: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  roles: RoleSummary[];
  permissions: string[];
  sites: SiteSummary[];
  createdAt: string;
}

export interface AdminUser extends UserProfile {
  siteIds: string[];
  roleIds: string[];
}

export interface Permission {
  code: string;
  name: string;
  group: string;
}

export interface PermissionGroup {
  group: string;
  items: Permission[];
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  detail: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* 栏目 / 文章 / 标签                                                   */
/* ------------------------------------------------------------------ */

export interface Category {
  id: string;
  siteId: string;
  parentId: string | null;
  name: string;
  slug: string;
  type: CategoryType;
  description: string | null;
  icon: string | null;
  sort: number;
  status: EntityStatus;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  content: string | null;
  template: string | null;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface Tag {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  articleCount: number;
  createdAt: string;
}

export interface ArticleTagRef {
  id: string;
  name: string;
  slug: string;
}

export interface Article {
  id: string;
  siteId: string;
  categoryId: string | null;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  cover: string | null;
  status: ArticleStatus;
  isTop: boolean;
  isRecommend: boolean;
  views: number;
  sort: number;
  authorId: string | null;
  authorName: string | null;
  publishedAt: string | null;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string } | null;
  tags: ArticleTagRef[];
}

/** 列表场景下 content 被裁剪，仅保留摘要信息 */
export type ArticleListItem = Omit<Article, 'content'> & { content?: undefined };

export interface ArticleQuery extends PageQuery {
  siteId?: string;
  categoryId?: string;
  tagId?: string;
  status?: ArticleStatus;
  authorId?: string;
  isTop?: boolean;
  isRecommend?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'views' | 'sort';
  order?: SortOrder;
}

export interface ArticleInput {
  siteId?: string;
  categoryId?: string | null;
  title: string;
  slug?: string;
  summary?: string | null;
  content: string;
  cover?: string | null;
  status?: ArticleStatus;
  isTop?: boolean;
  isRecommend?: boolean;
  sort?: number;
  publishedAt?: string | null;
  tagIds?: string[];
  seoTitle?: string | null;
  seoKeywords?: string | null;
  seoDescription?: string | null;
}

export type ArticleBatchAction =
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'delete'
  | 'top'
  | 'untop'
  | 'recommend'
  | 'unrecommend';

/* ------------------------------------------------------------------ */
/* 媒体                                                                */
/* ------------------------------------------------------------------ */

export interface Media {
  id: string;
  siteId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  folder: string | null;
  uploadedById: string | null;
  createdAt: string;
}

export interface MediaQuery extends PageQuery {
  siteId?: string;
  mimeType?: string;
  folder?: string;
}

/* ------------------------------------------------------------------ */
/* 会员 / 评论 / 表单                                                   */
/* ------------------------------------------------------------------ */

export interface Member {
  id: string;
  siteId: string;
  username: string;
  email: string;
  nickname: string | null;
  avatar: string | null;
  status: MemberStatus;
  points: number;
  lastLoginAt: string | null;
  createdAt: string;
  commentCount?: number;
}

export interface MemberTokenPayload {
  sub: string;
  type: 'member';
  siteId: string;
  username: string;
}

export interface PublicMember {
  id: string;
  username: string;
  nickname: string | null;
  avatar: string | null;
  email: string;
  points: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  siteId: string;
  articleId: string;
  memberId: string | null;
  parentId: string | null;
  nickname: string;
  email: string | null;
  content: string;
  status: CommentStatus;
  ip: string | null;
  createdAt: string;
  article?: { id: string; title: string; slug: string } | null;
}

export interface CommentNode extends Comment {
  children: CommentNode[];
}

export interface PublicComment {
  id: string;
  parentId: string | null;
  nickname: string;
  avatar: string | null;
  content: string;
  createdAt: string;
  children: PublicComment[];
}

export interface CommentQuery extends PageQuery {
  siteId?: string;
  status?: CommentStatus;
  articleId?: string;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'select' | 'radio' | 'checkbox' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
}

export interface Form {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  description: string | null;
  fields: FormField[];
  status: FormStatus;
  successMessage: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  ip: string | null;
  read: boolean;
  createdAt: string;
}

export interface FormInput {
  name: string;
  slug?: string;
  description?: string | null;
  fields: FormField[];
  status?: FormStatus;
  successMessage?: string | null;
}

/* ------------------------------------------------------------------ */
/* 设置 / 插件 / 仪表盘                                                 */
/* ------------------------------------------------------------------ */

export interface SettingItem {
  key: string;
  value: string | null;
  group: string;
}

export interface SettingsMap {
  [group: string]: Record<string, string | null>;
}

export interface Plugin {
  key: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  builtin: boolean;
  hooks: string[];
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  site?: { id: string; name: string; slug: string } | null;
  articles: { total: number; published: number; draft: number; today: number };
  comments: { total: number; pending: number; approved: number };
  members: { total: number; today: number };
  media: { total: number; size: number };
  views: { total: number; topArticles: { id: string; title: string; views: number }[] };
  trend: { date: string; articles: number; comments: number; views: number }[];
  recentComments: {
    id: string;
    nickname: string;
    content: string;
    status: CommentStatus;
    articleTitle: string | null;
    createdAt: string;
  }[];
  system: {
    nodeVersion: string;
    uptime: number;
    database: string;
    pluginsEnabled: number;
    sites: number;
  };
}

/* ------------------------------------------------------------------ */
/* 门户（Public）契约                                                   */
/* ------------------------------------------------------------------ */

export interface PublicSite {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  themeKey: string;
  settings: SiteSettings | null;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  type: CategoryType;
  icon: string | null;
  children: PublicCategory[];
}

export interface PublicArticleCard {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover: string | null;
  isTop: boolean;
  isRecommend: boolean;
  views: number;
  readingTime: number;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string }[];
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface PublicArticleDetail extends PublicArticleCard {
  content: string;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  authorName: string | null;
  toc: TocItem[];
  prev: { id: string; title: string; slug: string } | null;
  next: { id: string; title: string; slug: string } | null;
  related: { id: string; title: string; slug: string; cover: string | null; publishedAt: string | null }[];
  commentCount: number;
}

export interface PublicThemePayload {
  site: PublicSite;
  theme: { key: string; name: string; config: Record<string, unknown> | null };
}

export interface PublicSiteQuery {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  tagSlug?: string;
  keyword?: string;
  featured?: boolean;
  sort?: 'latest' | 'hot';
}

export interface PublicArchiveGroup {
  year: number;
  months: { month: number; count: number }[];
}

export interface PublicPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* 小说领域（书籍 / 分卷 / 章节 / 书架 / VIP / 作者 / 采集）              */
/* ------------------------------------------------------------------ */

export type NovelStatus = 'serial' | 'completed';
export type NovelAuditStatus = 'pending' | 'published' | 'rejected' | 'offline';
export type ChapterStatus = 'draft' | 'published';
export type OrderStatus = 'pending' | 'paid' | 'cancelled';
export type CoinTransactionType = 'recharge' | 'consume' | 'refund' | 'reward';
export type AuthorStatus = 'pending' | 'approved' | 'rejected';
export type CollectTaskStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

export const NOVEL_STATUS_LABELS: Record<NovelStatus, string> = {
  serial: '连载中',
  completed: '已完结',
};

export const NOVEL_AUDIT_LABELS: Record<NovelAuditStatus, string> = {
  pending: '待审核',
  published: '已上架',
  rejected: '已驳回',
  offline: '已下架',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

export interface NovelCategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface ChapterSummary {
  id: string;
  novelId: string;
  volumeId: string | null;
  chapterNo: number;
  title: string;
  wordCount: number;
  isVip: boolean;
  price: number;
  status: ChapterStatus;
  views: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface NovelVolume {
  id: string;
  novelId: string;
  title: string;
  sort: number;
  chapters: ChapterSummary[];
}

export interface LatestChapterRef {
  id: string;
  chapterNo: number;
  title: string;
  updatedAt: string;
}

export interface NovelCard {
  id: string;
  siteId: string;
  categoryId: string | null;
  authorId: string | null;
  authorName: string;
  title: string;
  slug: string;
  cover: string | null;
  summary: string | null;
  status: NovelStatus;
  auditStatus: NovelAuditStatus;
  isRecommend: boolean;
  isTop: boolean;
  words: number;
  chapterCount: number;
  views: number;
  favorites: number;
  vipOnly: boolean;
  publishedAt: string | null;
  lastChapterAt: string | null;
  updatedAt: string;
  category: NovelCategoryRef | null;
  latestChapter: LatestChapterRef | null;
}

/** 门户书籍详情：卡片字段 + 分卷目录 + 互动信息 */
export interface NovelDetail extends NovelCard {
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  volumes: NovelVolume[];
  firstChapter: LatestChapterRef | null;
  commentCount: number;
  inBookshelf?: boolean;
  progress?: { chapterId: string; chapterNo: number; percent: number; updatedAt: string } | null;
  unlockedChapterIds?: string[];
}

export interface NovelInput {
  title: string;
  slug?: string;
  authorName: string;
  categoryId?: string | null;
  cover?: string | null;
  summary?: string | null;
  status?: NovelStatus;
  auditStatus?: NovelAuditStatus;
  isRecommend?: boolean;
  isTop?: boolean;
  vipOnly?: boolean;
  seoTitle?: string | null;
  seoKeywords?: string | null;
  seoDescription?: string | null;
  authorId?: string | null;
}

export interface NovelQuery extends PageQuery {
  categoryId?: string;
  categorySlug?: string;
  status?: NovelStatus;
  auditStatus?: NovelAuditStatus;
  authorId?: string;
  isRecommend?: boolean;
  keyword?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'views' | 'favorites' | 'words';
  order?: SortOrder;
}

export interface ChapterInput {
  title: string;
  content: string;
  volumeId?: string | null;
  chapterNo?: number;
  isVip?: boolean;
  price?: number;
  status?: ChapterStatus;
}

export interface VolumeInput {
  title: string;
  sort?: number;
}

/** 章节正文（门户阅读器） */
export interface ChapterContent {
  id: string;
  novelId: string;
  novelSlug: string;
  novelTitle: string;
  volumeId: string | null;
  chapterNo: number;
  title: string;
  content: string;
  wordCount: number;
  isVip: boolean;
  price: number;
  /** 是否因未购买而锁定（锁定 content 为空，仅返回 preview） */
  locked: boolean;
  unlocked: boolean;
  preview: string | null;
  balance: number | null;
  prevChapter: LatestChapterRef | null;
  nextChapter: LatestChapterRef | null;
  readingTime: number;
  views: number;
  publishedAt: string | null;
}

export interface NovelCatalog {
  novel: { id: string; title: string; slug: string; authorName: string };
  volumes: NovelVolume[];
  totalChapters: number;
}

export interface NovelRankType {
  type: 'hot' | 'new' | 'favorite' | 'words';
}

export interface BookshelfItem {
  novel: NovelCard;
  addedAt: string;
  lastChapter: LatestChapterRef | null;
  progress: { chapterId: string; chapterNo: number; percent: number; updatedAt: string } | null;
}

export interface ReadingHistoryItem {
  novel: NovelCard;
  chapterId: string;
  chapterNo: number;
  chapterTitle: string;
  percent: number;
  updatedAt: string;
}

export interface WalletInfo {
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
}

export interface CoinTransactionItem {
  id: string;
  type: CoinTransactionType;
  amount: number;
  balance: number;
  remark: string | null;
  createdAt: string;
}

export interface RechargeOrder {
  id: string;
  orderNo: string;
  amountCents: number;
  coins: number;
  status: OrderStatus;
  channel: string;
  paidAt: string | null;
  createdAt: string;
}

export interface RechargePlan {
  id: string;
  label: string;
  coins: number;
  amountCents: number;
  bonusCoins?: number;
}

export interface UnlockChapterResult {
  chapterId: string;
  unlocked: boolean;
  balance: number;
  spent: number;
}

export interface AuthorProfile {
  id: string;
  memberId: string;
  penName: string;
  bio: string | null;
  status: AuthorStatus;
  contact: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
}

export interface AuthorStats {
  novelCount: number;
  chapterCount: number;
  totalWords: number;
  totalViews: number;
  totalFavorites: number;
  todayViews: number;
}

export interface AuthorNovelItem extends NovelCard {
  pendingChapters: number;
}

export interface NovelComment {
  id: string;
  siteId: string;
  novelId: string;
  chapterId: string | null;
  memberId: string | null;
  parentId: string | null;
  nickname: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  chapterTitle?: string | null;
}

export interface NovelCommentNode extends NovelComment {
  children: NovelCommentNode[];
}

export interface PublicNovelComment {
  id: string;
  parentId: string | null;
  nickname: string;
  avatar: string | null;
  content: string;
  createdAt: string;
  children: PublicNovelComment[];
}

export interface CollectSelectors {
  /** 书籍页字段选择器（html 模式为 CSS 选择器） */
  bookTitle?: string;
  bookAuthor?: string;
  bookCover?: string;
  bookSummary?: string;
  /** 章节链接选择器（html 模式）或 JSON 字段名（json 模式） */
  chapterLinks?: string;
  chapterTitle?: string;
  chapterContent?: string;
  /** json 模式下的响应字段路径 */
  listPath?: string;
  itemsPath?: string;
  titlePath?: string;
  contentPath?: string;
  /** 站点前缀，用于补全相对链接 */
  linkPrefix?: string;
}

export interface BookSource {
  id: string;
  siteId: string;
  name: string;
  type: 'html' | 'json';
  baseUrl: string;
  listUrl: string | null;
  selectors: CollectSelectors | null;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookSourceInput {
  name: string;
  type?: 'html' | 'json';
  baseUrl: string;
  listUrl?: string | null;
  selectors?: CollectSelectors | null;
  enabled?: boolean;
}

export interface CollectTask {
  id: string;
  siteId: string;
  sourceId: string | null;
  novelId: string | null;
  mode: 'book' | 'chapters';
  status: CollectTaskStatus;
  total: number;
  succeeded: number;
  failed: number;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  sourceName?: string | null;
  novelTitle?: string | null;
}

export interface CollectRunInput {
  sourceId: string;
  /** 采集书籍页 URL；缺省用书源 baseUrl */
  bookUrl?: string;
  /** 已存在书籍则追加章节 */
  novelId?: string;
  /** 最多采集章节数 */
  limit?: number;
}

export interface TxtImportResult {
  novelId: string;
  chapters: number;
  words: number;
}

export interface NovelDashboardStats {
  novels: { total: number; serial: number; completed: number; pending: number; today: number };
  chapters: { total: number; today: number; words: number };
  revenue: { todayCoins: number; totalCoins: number; ordersToday: number; ordersPaid: number };
  members: { total: number; today: number };
  reads: { total: number; today: number };
  authorApplications: number;
  pendingComments: number;
  collectTasks: number;
}
