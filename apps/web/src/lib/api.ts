'use client';

import type {
  AdminUser,
  ApiResponse,
  Article,
  ArticleBatchAction,
  ArticleInput,
  ArticleListItem,
  ArticleQuery,
  AuditLog,
  Category,
  CategoryNode,
  Comment,
  CommentQuery,
  DashboardStats,
  Form,
  FormInput,
  FormSubmission,
  LoginPayload,
  LoginResult,
  Media,
  MediaQuery,
  Member,
  Paginated,
  PermissionGroup,
  Plugin,
  RefreshResult,
  Role,
  RoleSummary,
  SettingsMap,
  SettingItem,
  Site,
  SiteSummary,
  Tag,
  Theme,
  UserProfile,
} from '@wmcms/shared';
import { tokenStorage } from './tokens';

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

// 便于业务组件从统一入口导入常用输入类型
export type { FormInput } from '@wmcms/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: string[];
  readonly requestId?: string;

  constructor(status: number, message: string, errors?: string[], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.requestId = requestId;
  }
}

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  formData?: FormData;
  retryOnAuth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** 单次请求超时（ms）：接口挂死时让调用方拿到可处理的错误，而不是无限 loading */
const REQUEST_TIMEOUT_MS = 10_000;

/** 给 fetch 挂默认超时；调用方自带 signal 时与超时 signal 合并 */
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** 令牌已确定失效：清理本地令牌并广播，由 AuthGuard 统一跳转登录页 */
function notifyAuthExpired(): void {
  tokenStorage.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:expired'));
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) {
    notifyAuthExpired();
    return false;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        // 刷新令牌被拒（过期 / 已被轮换 / 已吊销）→ 会话确定失效
        notifyAuthExpired();
        return false;
      }
      const payload = (await response.json()) as ApiResponse<RefreshResult>;
      if (!payload?.data?.accessToken) {
        notifyAuthExpired();
        return false;
      }
      tokenStorage.set(payload.data.accessToken, payload.data.refreshToken);
      return true;
    } catch {
      // 网络异常 / 超时 ≠ 会话失效：保留令牌，下一次请求自然重试。
      // 这里不清令牌是刻意的，否则弱网或 10s 超时会把用户直接登出。
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, formData, retryOnAuth = true, signal } = options;
  const perform = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const accessToken = tokenStorage.getAccess();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const siteId = tokenStorage.getSiteId();
    if (siteId) headers['X-Site-Id'] = siteId;
    if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: withTimeout(signal),
    });
  };

  let response = await perform();

  if (response.status === 401 && retryOnAuth && tokenStorage.getRefresh()) {
    const refreshed = await refreshTokens();
    if (refreshed) response = await perform();
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const errorPayload = payload as
      | { message?: string; errors?: string[]; requestId?: string }
      | null;
    throw new ApiError(
      response.status,
      errorPayload?.message || `请求失败（HTTP ${response.status}）`,
      errorPayload?.errors,
      errorPayload?.requestId,
    );
  }

  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}

/* ------------------------------------------------------------------ */
/* 认证                                                                */
/* ------------------------------------------------------------------ */

export const authApi = {
  login: (input: LoginPayload) =>
    request<LoginResult>('/auth/login', { method: 'POST', body: input, retryOnAuth: false }),
  refresh: (refreshToken: string) =>
    request<RefreshResult>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      retryOnAuth: false,
    }),
  profile: () => request<UserProfile>('/auth/profile'),
  changePassword: (input: { oldPassword: string; newPassword: string }) =>
    request<null>('/auth/password', { method: 'PATCH', body: input }),
  logout: () => request<null>('/auth/logout', { method: 'POST', retryOnAuth: false }),
};

/* ------------------------------------------------------------------ */
/* 站点 / 主题                                                          */
/* ------------------------------------------------------------------ */

export type SiteInput = Partial<Omit<Site, 'id' | 'createdAt' | 'updatedAt'>> & { name: string };

export const sitesApi = {
  list: (query: { page?: number; pageSize?: number; keyword?: string; status?: string } = {}) =>
    request<Paginated<Site>>('/sites', { query }),
  options: () => request<SiteSummary[]>('/sites/options'),
  get: (id: string) => request<Site>(`/sites/${id}`),
  create: (input: SiteInput) => request<Site>('/sites', { method: 'POST', body: input }),
  update: (id: string, input: Partial<SiteInput>) =>
    request<Site>(`/sites/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/sites/${id}`, { method: 'DELETE' }),
};

export const themesApi = {
  list: () => request<Theme[]>('/themes'),
  activate: (siteId: string, themeKey: string) =>
    request<Site>('/themes/activate', { method: 'POST', body: { siteId, themeKey } }),
};

/* ------------------------------------------------------------------ */
/* 栏目 / 文章 / 标签                                                   */
/* ------------------------------------------------------------------ */

export type CategoryInput = Partial<
  Pick<
    Category,
    | 'parentId'
    | 'type'
    | 'description'
    | 'icon'
    | 'sort'
    | 'status'
    | 'seoTitle'
    | 'seoKeywords'
    | 'seoDescription'
    | 'content'
    | 'template'
  >
> & { name: string; slug?: string };

export const categoriesApi = {
  list: (query: { type?: string; status?: string } = {}) =>
    request<Category[]>('/categories', { query }),
  tree: () => request<CategoryNode[]>('/categories/tree'),
  get: (id: string) => request<Category>(`/categories/${id}`),
  create: (input: CategoryInput) =>
    request<Category>('/categories', { method: 'POST', body: input }),
  update: (id: string, input: Partial<CategoryInput>) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/categories/${id}`, { method: 'DELETE' }),
};

export const articlesApi = {
  list: (query: ArticleQuery = {}) =>
    request<Paginated<ArticleListItem>>('/articles', { query: query as Record<string, QueryValue> }),
  get: (id: string) => request<Article>(`/articles/${id}`),
  create: (input: ArticleInput) => request<Article>('/articles', { method: 'POST', body: input }),
  update: (id: string, input: Partial<ArticleInput>) =>
    request<Article>(`/articles/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/articles/${id}`, { method: 'DELETE' }),
  publish: (id: string) => request<Article>(`/articles/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) => request<Article>(`/articles/${id}/unpublish`, { method: 'POST' }),
  batch: (ids: string[], action: ArticleBatchAction) =>
    request<{ affected: number }>('/articles/batch', { method: 'POST', body: { ids, action } }),
};

export type TagInput = { name: string; slug?: string };

export const tagsApi = {
  list: (query: { page?: number; pageSize?: number; keyword?: string } = {}) =>
    request<Paginated<Tag>>('/tags', { query }),
  options: () => request<Tag[]>('/tags/options'),
  create: (input: TagInput) => request<Tag>('/tags', { method: 'POST', body: input }),
  update: (id: string, input: Partial<TagInput>) =>
    request<Tag>(`/tags/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/tags/${id}`, { method: 'DELETE' }),
};

/* ------------------------------------------------------------------ */
/* 媒体库                                                              */
/* ------------------------------------------------------------------ */

export const mediaApi = {
  list: (query: MediaQuery = {}) =>
    request<Paginated<Media>>('/media', { query: query as Record<string, QueryValue> }),
  upload: (file: File, siteId: string, folder?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('siteId', siteId);
    if (folder) formData.append('folder', folder);
    return request<Media>('/media/upload', { method: 'POST', formData });
  },
  remove: (id: string) => request<null>(`/media/${id}`, { method: 'DELETE' }),
  batchDelete: (ids: string[]) =>
    request<{ affected: number }>('/media/batch-delete', { method: 'POST', body: { ids } }),
};

/* ------------------------------------------------------------------ */
/* 管理员 / 角色 / 权限 / 审计                                          */
/* ------------------------------------------------------------------ */

export type UserInput = {
  username: string;
  email: string;
  password?: string;
  nickname?: string | null;
  avatar?: string | null;
  status?: string;
  isSuperAdmin?: boolean;
  roleIds?: string[];
  siteIds?: string[];
};

export const usersApi = {
  list: (query: { page?: number; pageSize?: number; keyword?: string; status?: string } = {}) =>
    request<Paginated<AdminUser>>('/users', { query }),
  get: (id: string) => request<AdminUser>(`/users/${id}`),
  create: (input: UserInput) => request<AdminUser>('/users', { method: 'POST', body: input }),
  update: (id: string, input: Partial<UserInput>) =>
    request<AdminUser>(`/users/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/users/${id}`, { method: 'DELETE' }),
  setStatus: (id: string, status: string) =>
    request<AdminUser>(`/users/${id}/status`, { method: 'PATCH', body: { status } }),
};

export type RoleInput = {
  name: string;
  code: string;
  description?: string | null;
  permissionCodes: string[];
};

export const rolesApi = {
  list: (query: { page?: number; pageSize?: number; keyword?: string } = {}) =>
    request<Paginated<Role>>('/roles', { query }),
  options: () => request<RoleSummary[]>('/roles/options'),
  get: (id: string) => request<Role>(`/roles/${id}`),
  create: (input: RoleInput) => request<Role>('/roles', { method: 'POST', body: input }),
  update: (id: string, input: Partial<RoleInput>) =>
    request<Role>(`/roles/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/roles/${id}`, { method: 'DELETE' }),
};

export const permissionsApi = {
  groups: () => request<PermissionGroup[]>('/permissions'),
};

export const auditApi = {
  list: (
    query: {
      page?: number;
      pageSize?: number;
      userId?: string;
      action?: string;
      resource?: string;
      from?: string;
      to?: string;
    } = {},
  ) => request<Paginated<AuditLog>>('/audit-logs', { query }),
};

/* ------------------------------------------------------------------ */
/* 会员 / 评论 / 表单（管理端）                                          */
/* ------------------------------------------------------------------ */

export type MemberInput = {
  username: string;
  email: string;
  password?: string;
  nickname?: string | null;
  avatar?: string | null;
  status?: string;
  points?: number;
};

export const membersApi = {
  list: (query: { page?: number; pageSize?: number; keyword?: string; status?: string } = {}) =>
    request<Paginated<Member>>('/members', { query }),
  get: (id: string) => request<Member>(`/members/${id}`),
  create: (input: MemberInput) => request<Member>('/members', { method: 'POST', body: input }),
  update: (id: string, input: Partial<MemberInput>) =>
    request<Member>(`/members/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/members/${id}`, { method: 'DELETE' }),
  setStatus: (id: string, status: string) =>
    request<Member>(`/members/${id}/status`, { method: 'PATCH', body: { status } }),
  resetPassword: (id: string, password: string) =>
    request<null>(`/members/${id}/reset-password`, { method: 'POST', body: { password } }),
};

export const commentsApi = {
  list: (query: CommentQuery = {}) =>
    request<Paginated<Comment>>('/comments', { query: query as Record<string, QueryValue> }),
  setStatus: (id: string, status: 'approved' | 'rejected') =>
    request<Comment>(`/comments/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string) => request<null>(`/comments/${id}`, { method: 'DELETE' }),
  batch: (ids: string[], action: 'approve' | 'reject' | 'delete') =>
    request<{ affected: number }>('/comments/batch', { method: 'POST', body: { ids, action } }),
};

export const formsApi = {
  list: () => request<Form[]>('/forms'),
  get: (id: string) => request<Form>(`/forms/${id}`),
  create: (input: FormInput) => request<Form>('/forms', { method: 'POST', body: input }),
  update: (id: string, input: Partial<FormInput>) =>
    request<Form>(`/forms/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/forms/${id}`, { method: 'DELETE' }),
  submissions: (id: string, query: { page?: number; pageSize?: number; read?: boolean } = {}) =>
    request<Paginated<FormSubmission>>(`/forms/${id}/submissions`, { query }),
  markRead: (submissionId: string, read = true) =>
    request<FormSubmission>(`/forms/submissions/${submissionId}/read`, {
      method: 'PATCH',
      body: { read },
    }),
  removeSubmission: (submissionId: string) =>
    request<null>(`/forms/submissions/${submissionId}`, { method: 'DELETE' }),
};

/* ------------------------------------------------------------------ */
/* 设置 / 插件 / 仪表盘                                                 */
/* ------------------------------------------------------------------ */

export const settingsApi = {
  get: (siteId?: string | null) =>
    request<SettingsMap>('/settings', { query: { siteId: siteId ?? undefined } }),
  update: (items: SettingItem[], siteId?: string | null) =>
    request<SettingsMap>('/settings', { method: 'PUT', body: { siteId: siteId ?? null, items } }),
};

export const pluginsApi = {
  list: () => request<Plugin[]>('/plugins'),
  get: (key: string) => request<Plugin>(`/plugins/${key}`),
  update: (key: string, input: { enabled?: boolean; config?: Record<string, unknown> }) =>
    request<Plugin>(`/plugins/${key}`, { method: 'PATCH', body: input }),
};

export const dashboardApi = {
  stats: () => request<DashboardStats>('/dashboard/stats'),
};

export const api = {
  auth: authApi,
  sites: sitesApi,
  themes: themesApi,
  categories: categoriesApi,
  articles: articlesApi,
  tags: tagsApi,
  media: mediaApi,
  users: usersApi,
  roles: rolesApi,
  permissions: permissionsApi,
  audit: auditApi,
  members: membersApi,
  comments: commentsApi,
  forms: formsApi,
  settings: settingsApi,
  plugins: pluginsApi,
  dashboard: dashboardApi,
};

export default api;

/* ================================================================== */
/* 小说站 API（书籍 / 章节 / 书架 / VIP / 作者 / 采集）                  */
/* ================================================================== */

import type {
  AuthorNovelItem,
  AuthorProfile,
  AuthorStats,
  BookSource,
  BookSourceInput,
  BookshelfItem,
  ChapterContent,
  ChapterInput,
  ChapterStatus,
  ChapterSummary,
  CoinTransactionItem,
  CollectRunInput,
  CollectTask,
  NovelAuditStatus,
  NovelCard,
  NovelCatalog,
  NovelComment,
  NovelDashboardStats,
  NovelDetail,
  NovelInput,
  NovelQuery,
  NovelStatus,
  NovelVolume,
  RechargeOrder,
  ReadingHistoryItem,
  TxtImportResult,
  UnlockChapterResult,
  VolumeInput,
  WalletInfo,
} from '@wmcms/shared';

/** 门户会员接口请求（Bearer 会员令牌，自动解包响应信封） */
async function memberRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    query?: Record<string, QueryValue>;
    auth?: boolean;
  } = {},
): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  // 会员令牌统一由 lib/tokens 管理，避免同一存储键在多处硬编码后漂移
  const token = tokenStorage.getMemberToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const errorPayload = payload as { message?: string; errors?: string[]; requestId?: string } | null;
    throw new ApiError(
      response.status,
      errorPayload?.message || `请求失败（HTTP ${response.status}）`,
      errorPayload?.errors,
      errorPayload?.requestId,
    );
  }

  // 2xx 但不是 JSON：多半是反向代理/网关错误页或登录重定向。
  // 静默返回 null 会把故障伪装成「暂无数据」，调用方还会因 null 解引用而崩，
  // 因此除 204/205（合法的空响应）外一律抛错。
  if (!isJson && response.status !== 204 && response.status !== 205) {
    throw new ApiError(response.status, '服务返回了非 JSON 响应（可能是网关错误页），请稍后重试');
  }

  const envelope = payload as { data?: T } | null;
  return (envelope?.data ?? null) as T;
}

/* ---------------------------- 管理端：书籍 ---------------------------- */

export const novelsApi = {
  list: (query: NovelQuery & { auditStatus?: NovelAuditStatus } = {}) =>
    request<Paginated<NovelCard>>('/novels', { query: query as Record<string, QueryValue> }),
  get: (id: string) => request<NovelDetail | NovelCard>(`/novels/${id}`),
  create: (input: NovelInput) => request<NovelCard>('/novels', { method: 'POST', body: input }),
  update: (id: string, input: Partial<NovelInput>) =>
    request<NovelCard>(`/novels/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/novels/${id}`, { method: 'DELETE' }),
  review: (id: string, auditStatus: NovelAuditStatus, reason?: string) =>
    request<NovelCard>(`/novels/${id}/review`, {
      method: 'POST',
      body: { auditStatus, reason },
    }),
  batch: (
    ids: string[],
    action: 'publish' | 'offline' | 'recommend' | 'unrecommend' | 'delete',
  ) => request<{ affected: number }>('/novels/batch', { method: 'POST', body: { ids, action } }),

  volumes: (novelId: string) => request<NovelVolume[]>(`/novels/${novelId}/volumes`),
  createVolume: (novelId: string, input: VolumeInput) =>
    request<NovelVolume>(`/novels/${novelId}/volumes`, { method: 'POST', body: input }),
  updateVolume: (volumeId: string, input: Partial<VolumeInput>) =>
    request<NovelVolume>(`/volumes/${volumeId}`, { method: 'PATCH', body: input }),
  removeVolume: (volumeId: string) =>
    request<null>(`/volumes/${volumeId}`, { method: 'DELETE' }),

  importTxt: (novelId: string, file: File, volumeTitle?: string, pattern?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (volumeTitle) formData.append('volumeTitle', volumeTitle);
    if (pattern) formData.append('pattern', pattern);
    return request<TxtImportResult>(`/novels/${novelId}/import-txt`, {
      method: 'POST',
      formData,
    });
  },
};

export const chaptersApi = {
  list: (query: {
    novelId: string;
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: ChapterStatus;
  }) => request<Paginated<ChapterSummary>>('/chapters', { query }),
  get: (id: string) => request<ChapterSummary & { content: string }>(`/chapters/${id}`),
  create: (input: ChapterInput & { novelId: string }) =>
    request<ChapterSummary>('/chapters', { method: 'POST', body: input }),
  update: (id: string, input: Partial<ChapterInput>) =>
    request<ChapterSummary>(`/chapters/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<null>(`/chapters/${id}`, { method: 'DELETE' }),
  publish: (id: string) => request<ChapterSummary>(`/chapters/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) =>
    request<ChapterSummary>(`/chapters/${id}/unpublish`, { method: 'POST' }),
};

/* ---------------------------- 管理端：采集 ---------------------------- */

export const collectApi = {
  sources: () => request<BookSource[]>('/book-sources'),
  createSource: (input: BookSourceInput) =>
    request<BookSource>('/book-sources', { method: 'POST', body: input }),
  updateSource: (id: string, input: Partial<BookSourceInput>) =>
    request<BookSource>(`/book-sources/${id}`, { method: 'PATCH', body: input }),
  removeSource: (id: string) => request<null>(`/book-sources/${id}`, { method: 'DELETE' }),
  testSource: (id: string, bookUrl?: string) =>
    request<{
      book: { title: string; author: string; cover: string | null; summary: string | null };
      chapters: { title: string }[];
    }>(`/book-sources/${id}/test`, { method: 'POST', body: { bookUrl } }),
  run: (input: CollectRunInput) =>
    request<CollectTask>('/collect/run', { method: 'POST', body: input }),
  tasks: (query: { page?: number; pageSize?: number; status?: string } = {}) =>
    request<Paginated<CollectTask>>('/collect/tasks', { query }),
  task: (id: string) => request<CollectTask>(`/collect/tasks/${id}`),
};

/* ---------------------------- 管理端：VIP / 作者 / 评论 ---------------- */

export const vipApi = {
  orders: (query: { page?: number; pageSize?: number; status?: string; keyword?: string } = {}) =>
    request<Paginated<RechargeOrder & { member?: { id: string; username: string; nickname: string | null } }>>(
      '/vip/orders',
      { query },
    ),
  unlocks: (query: { page?: number; pageSize?: number; memberId?: string; novelId?: string } = {}) =>
    request<
      Paginated<{
        id: string;
        coins: number;
        createdAt: string;
        member?: { id: string; username: string };
        chapter?: { id: string; chapterNo: number; title: string; novel?: { id: string; title: string } };
      }>
    >('/vip/unlocks', { query }),
  transactions: (query: { page?: number; pageSize?: number; type?: string; memberId?: string } = {}) =>
    request<Paginated<CoinTransactionItem & { member?: { id: string; username: string } }>>(
      '/vip/transactions',
      { query },
    ),
  credit: (input: { memberId: string; amount: number; remark?: string }) =>
    request<{ balance: number }>('/vip/credit', { method: 'POST', body: input }),
};

export const authorApplicationsApi = {
  list: (query: { page?: number; pageSize?: number; status?: string } = {}) =>
    request<
      Paginated<
        AuthorProfile & { member?: { id: string; username: string; nickname: string | null; email: string } }
      >
    >('/author-applications', { query }),
  review: (id: string, status: 'approved' | 'rejected', reason?: string) =>
    request<AuthorProfile>(`/author-applications/${id}/review`, {
      method: 'POST',
      body: { status, reason },
    }),
};

export const novelCommentsApi = {
  list: (query: {
    page?: number;
    pageSize?: number;
    status?: string;
    novelId?: string;
    chapterId?: string;
  } = {}) =>
    request<Paginated<NovelComment & { novel?: { id: string; title: string }; chapter?: { id: string; title: string } | null }>>(
      '/novel-comments',
      { query },
    ),
  setStatus: (id: string, status: 'approved' | 'rejected') =>
    request<NovelComment>(`/novel-comments/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string) => request<null>(`/novel-comments/${id}`, { method: 'DELETE' }),
};

export const novelDashboardApi = {
  stats: () => request<NovelDashboardStats>('/dashboard/novel-stats'),
};

/* ---------------------------- 门户会员 / 阅读器 ------------------------ */

export const readerApi = {
  chapter: (siteSlug: string, novelSlug: string, chapterNo: number) =>
    memberRequest<ChapterContent>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novels/${encodeURIComponent(novelSlug)}/chapters/${chapterNo}`,
    ),
  postComment: (
    siteSlug: string,
    input: { novelId: string; chapterId?: string | null; parentId?: string | null; content: string },
  ) =>
    memberRequest<{ id: string; status: string }>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novel-comments`,
      { method: 'POST', body: input },
    ),
  comments: (siteSlug: string, novelId: string, chapterId?: string | null) =>
    memberRequest<unknown[]>(`/public/sites/${encodeURIComponent(siteSlug)}/novel-comments`, {
      query: { novelId, chapterId: chapterId ?? undefined },
    }),

  shelf: (siteSlug: string) =>
    memberRequest<BookshelfItem[]>(`/public/sites/${encodeURIComponent(siteSlug)}/members/bookshelf`),
  addShelf: (siteSlug: string, novelId: string) =>
    memberRequest<{ added: boolean }>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/bookshelf`,
      { method: 'POST', body: { novelId } },
    ),
  removeShelf: (siteSlug: string, novelId: string) =>
    memberRequest<null>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/bookshelf/${encodeURIComponent(novelId)}`,
      { method: 'DELETE' },
    ),
  history: (siteSlug: string, page = 1, pageSize = 10) =>
    memberRequest<Paginated<ReadingHistoryItem>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/history`,
      { query: { page, pageSize } },
    ),
  saveProgress: (siteSlug: string, input: { novelId: string; chapterId: string; percent: number }) =>
    memberRequest<null>(`/public/sites/${encodeURIComponent(siteSlug)}/members/progress`, {
      method: 'PUT',
      body: input,
    }),

  wallet: (siteSlug: string) =>
    memberRequest<WalletInfo>(`/public/sites/${encodeURIComponent(siteSlug)}/members/wallet`),
  transactions: (siteSlug: string, page = 1, pageSize = 10) =>
    memberRequest<Paginated<CoinTransactionItem>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/transactions`,
      { query: { page, pageSize } },
    ),
  orders: (siteSlug: string, page = 1, pageSize = 10) =>
    memberRequest<Paginated<RechargeOrder>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/orders`,
      { query: { page, pageSize } },
    ),
  createOrder: (siteSlug: string, planId: string) =>
    memberRequest<RechargeOrder>(`/public/sites/${encodeURIComponent(siteSlug)}/members/orders`, {
      method: 'POST',
      body: { planId },
    }),
  payOrder: (siteSlug: string, orderNo: string) =>
    memberRequest<{ order: RechargeOrder; balance: number }>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/orders/${encodeURIComponent(orderNo)}/pay`,
      { method: 'POST' },
    ),
  unlockChapter: (siteSlug: string, chapterId: string) =>
    memberRequest<UnlockChapterResult>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/chapters/${encodeURIComponent(chapterId)}/unlock`,
      { method: 'POST' },
    ),

  authorProfile: (siteSlug: string) =>
    memberRequest<AuthorProfile | null>(`/public/sites/${encodeURIComponent(siteSlug)}/members/author`),
  applyAuthor: (siteSlug: string, input: { penName: string; bio?: string; contact?: string }) =>
    memberRequest<AuthorProfile>(`/public/sites/${encodeURIComponent(siteSlug)}/members/author`, {
      method: 'POST',
      body: input,
    }),
  authorStats: (siteSlug: string) =>
    memberRequest<AuthorStats>(`/public/sites/${encodeURIComponent(siteSlug)}/members/author/stats`),
  authorNovels: (siteSlug: string, page = 1, pageSize = 10) =>
    memberRequest<Paginated<AuthorNovelItem>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels`,
      { query: { page, pageSize } },
    ),
  createAuthorNovel: (siteSlug: string, input: NovelInput) =>
    memberRequest<NovelCard>(`/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels`, {
      method: 'POST',
      body: input,
    }),
  updateAuthorNovel: (siteSlug: string, novelId: string, input: Partial<NovelInput>) =>
    memberRequest<NovelCard>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels/${encodeURIComponent(novelId)}`,
      { method: 'PATCH', body: input },
    ),
  deleteAuthorNovel: (siteSlug: string, novelId: string) =>
    memberRequest<null>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels/${encodeURIComponent(novelId)}`,
      { method: 'DELETE' },
    ),
  authorChapters: (siteSlug: string, novelId: string, page = 1, pageSize = 50) =>
    memberRequest<Paginated<ChapterSummary>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels/${encodeURIComponent(novelId)}/chapters`,
      { query: { page, pageSize } },
    ),
  createAuthorChapter: (siteSlug: string, novelId: string, input: ChapterInput) =>
    memberRequest<ChapterSummary>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels/${encodeURIComponent(novelId)}/chapters`,
      { method: 'POST', body: input },
    ),
  updateAuthorChapter: (
    siteSlug: string,
    novelId: string,
    chapterId: string,
    input: Partial<ChapterInput>,
  ) =>
    memberRequest<ChapterSummary>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels/${encodeURIComponent(novelId)}/chapters/${encodeURIComponent(chapterId)}`,
      { method: 'PATCH', body: input },
    ),
  deleteAuthorChapter: (siteSlug: string, novelId: string, chapterId: string) =>
    memberRequest<null>(
      `/public/sites/${encodeURIComponent(siteSlug)}/members/author/novels/${encodeURIComponent(novelId)}/chapters/${encodeURIComponent(chapterId)}`,
      { method: 'DELETE' },
    ),
};
