/**
 * 浏览器端门户公开接口客户端（会员登录 / 评论 / 表单）。
 * 与 lib/server-api.ts 的 publicPost 保持同一套后端契约，但补齐 GET / PATCH 与错误结构。
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
  /\/+$/,
  '',
);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export class PublicApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PublicApiError';
    this.status = status;
  }
}

function sitePath(siteSlug: string, suffix: string): string {
  return `/public/sites/${encodeURIComponent(siteSlug)}${suffix}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new PublicApiError(0, '网络异常，请检查网络后重试');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { message?: string } | null)?.message || `请求失败（HTTP ${response.status}）`;
    throw new PublicApiError(response.status, message);
  }
  const data = (payload as { data?: T } | null)?.data;
  return (data ?? (payload as T)) as T;
}

export interface MemberLoginResult {
  member: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
    email: string;
    points: number;
    createdAt: string;
  };
  token: string;
}

export const publicClient = {
  sitePath,

  login: (siteSlug: string, input: { account: string; password: string }) =>
    request<MemberLoginResult>(sitePath(siteSlug, '/members/login'), {
      method: 'POST',
      body: input,
    }),

  register: (
    siteSlug: string,
    input: { username: string; email: string; password: string; nickname?: string },
  ) =>
    request<MemberLoginResult>(sitePath(siteSlug, '/members/register'), {
      method: 'POST',
      body: input,
    }),

  profile: (siteSlug: string, token: string) =>
    request<MemberLoginResult['member']>(sitePath(siteSlug, '/members/profile'), { token }),

  updateProfile: (
    siteSlug: string,
    token: string,
    input: { nickname?: string; avatar?: string; password?: string },
  ) =>
    request<MemberLoginResult['member']>(sitePath(siteSlug, '/members/profile'), {
      method: 'PATCH',
      body: input,
      token,
    }),

  myComments: (siteSlug: string, token: string) =>
    request<{
      items: Array<{
        id: string;
        content: string;
        status: 'pending' | 'approved' | 'rejected';
        createdAt: string;
        article: { id: string; title: string; slug: string } | null;
      }>;
      total: number;
      page: number;
      pageSize: number;
    }>(sitePath(siteSlug, '/members/comments'), { token }),

  submitComment: (
    siteSlug: string,
    articleSlug: string,
    input: { nickname?: string; email?: string; content: string; parentId?: string },
    token?: string | null,
  ) =>
    request<unknown>(
      sitePath(
        siteSlug,
        `/articles/${encodeURIComponent(articleSlug)}/comments`,
      ),
      { method: 'POST', body: input, token },
    ),
};
