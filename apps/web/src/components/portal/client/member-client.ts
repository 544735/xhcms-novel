'use client';

import type { CommentStatus, Paginated, PublicMember, PublicNovelComment } from '@wmcms/shared';
import { ApiError } from '@/lib/api';
import { tokenStorage } from '@/lib/tokens';

/**
 * 门户会员认证客户端（登录 / 注册 / 资料 / 我的评论）。
 *
 * 说明：`@/lib/api` 的 `readerApi` 覆盖了书架、钱包、订单、作者等会员接口，但未包含
 * `/members/{login,register,profile,comments,novel-categories}`。这些接口由后端
 * `PublicMembersController` 提供（见 docs/API_CONTRACT.md §12），因此在本模块按同一套
 * 响应信封约定补齐，避免修改 Lead 所有的 `lib/api.ts`。若后续 readerApi 补齐，可平滑替换。
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
  /\/+$/,
  '',
);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function sitePath(siteSlug: string, suffix: string): string {
  return `/public/sites/${encodeURIComponent(siteSlug)}${suffix}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = auth ? tokenStorage.getMemberToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorPayload = payload as { message?: string; errors?: string[]; requestId?: string } | null;
    throw new ApiError(
      response.status,
      errorPayload?.message || `请求失败（HTTP ${response.status}）`,
      errorPayload?.errors,
      errorPayload?.requestId,
    );
  }
  return ((payload as { data?: T } | null)?.data ?? null) as T;
}

export interface MemberLoginResult {
  member: PublicMember;
  token: string;
}

export interface MemberLoginInput {
  account: string;
  password: string;
}

export interface MemberRegisterInput {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}

/** 我的书评/章评（小说站 NovelComment） */
export interface MyNovelComment {
  id: string;
  content: string;
  status: CommentStatus;
  createdAt: string;
  novel: { id: string; title: string; slug: string } | null;
  chapter: { id: string; title: string; chapterNo: number } | null;
}

export const memberClient = {
  login: (siteSlug: string, input: MemberLoginInput) =>
    request<MemberLoginResult>(sitePath(siteSlug, '/members/login'), {
      method: 'POST',
      body: input,
      auth: false,
    }),

  register: (siteSlug: string, input: MemberRegisterInput) =>
    request<MemberLoginResult>(sitePath(siteSlug, '/members/register'), {
      method: 'POST',
      body: input,
      auth: false,
    }),

  profile: (siteSlug: string) =>
    request<PublicMember>(sitePath(siteSlug, '/members/profile')),

  updateProfile: (siteSlug: string, input: { nickname?: string; avatar?: string; password?: string }) =>
    request<PublicMember>(sitePath(siteSlug, '/members/profile'), {
      method: 'PATCH',
      body: input,
    }),

  myComments: (siteSlug: string, page = 1, pageSize = 10) =>
    request<Paginated<MyNovelComment>>(sitePath(siteSlug, '/members/novel-comments'), {
      query: { page, pageSize },
    }),

  /** 小说分类树（作者新建作品时选择分类；公开接口） */
  novelCategories: (siteSlug: string) =>
    request<
      { id: string; name: string; slug: string; type: string; icon: string | null; children: unknown[] }[]
    >(sitePath(siteSlug, '/novel-categories'), { auth: false }),
};

/** 是否会员登录态失效（401） */
export function isMemberAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export type { PublicNovelComment };
