import type {
  CategoryNode,
  Paginated,
  PublicArticleCard,
  PublicArticleDetail,
  PublicComment,
  PublicPage,
  PublicSite,
  PublicThemePayload,
  Tag,
} from '@wmcms/shared';

/**
 * 服务端渲染（RSC）专用 API 访问层。
 * 走内网地址，带 Next.js 缓存标签，失败时返回 null 由页面兜底。
 */
const SERVER_API_BASE = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

/** SSR 取数超时（ms）：API 挂死时尽快走「内容加载失败」兜底，而不是拖到整页超时 */
const SERVER_FETCH_TIMEOUT_MS = 10_000;

interface ServerFetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

async function serverGet<T>(path: string, options: ServerFetchOptions = {}): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      next: {
        revalidate: options.revalidate === undefined ? 30 : options.revalidate,
        tags: options.tags,
      },
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: T };
    return (payload?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

async function serverGetText(path: string): Promise<string | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}${path}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export const portalApi = {
  site: (slug: string) =>
    serverGet<PublicSite>(`/public/sites/${encodeURIComponent(slug)}`, {
      tags: [`site:${slug}`],
    }),
  theme: (slug: string) =>
    serverGet<PublicThemePayload>(`/public/sites/${encodeURIComponent(slug)}/theme`, {
      tags: [`site:${slug}`],
    }),
  categories: (slug: string) =>
    serverGet<CategoryNode[]>(`/public/sites/${encodeURIComponent(slug)}/categories`, {
      tags: [`site:${slug}:categories`],
    }),
  articles: (
    slug: string,
    query: {
      page?: number;
      pageSize?: number;
      categorySlug?: string;
      tagSlug?: string;
      keyword?: string;
      featured?: boolean;
      sort?: 'latest' | 'hot';
    } = {},
  ) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return serverGet<Paginated<PublicArticleCard>>(
      `/public/sites/${encodeURIComponent(slug)}/articles${suffix}`,
      { tags: [`site:${slug}:articles`] },
    );
  },
  article: (slug: string, articleSlug: string) =>
    serverGet<PublicArticleDetail>(
      `/public/sites/${encodeURIComponent(slug)}/articles/${encodeURIComponent(articleSlug)}`,
      { revalidate: 15, tags: [`site:${slug}:article:${articleSlug}`] },
    ),
  comments: (slug: string, articleSlug: string) =>
    serverGet<PublicComment[]>(
      `/public/sites/${encodeURIComponent(slug)}/articles/${encodeURIComponent(articleSlug)}/comments`,
      { revalidate: 10 },
    ),
  tags: (slug: string) =>
    serverGet<Tag[]>(`/public/sites/${encodeURIComponent(slug)}/tags`, {
      tags: [`site:${slug}:tags`],
    }),
  archive: (slug: string) =>
    serverGet<{ year: number; months: { month: number; count: number }[] }[]>(
      `/public/sites/${encodeURIComponent(slug)}/archive`,
      { tags: [`site:${slug}:archive`] },
    ),
  page: (slug: string, pageSlug: string) =>
    serverGet<PublicPage>(
      `/public/sites/${encodeURIComponent(slug)}/pages/${encodeURIComponent(pageSlug)}`,
      { tags: [`site:${slug}:page:${pageSlug}`] },
    ),
  search: (slug: string, q: string, page = 1, pageSize = 10) =>
    serverGet<Paginated<PublicArticleCard>>(
      `/public/sites/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
      { revalidate: 0 },
    ),
  sitemapXml: (slug: string) => serverGetText(`/public/sites/${encodeURIComponent(slug)}/sitemap.xml`),
  rssXml: (slug: string) => serverGetText(`/public/sites/${encodeURIComponent(slug)}/rss.xml`),
};

/** 浏览器端公开写接口（评论 / 表单 / 会员登录） */
export async function publicPost<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `提交失败（HTTP ${response.status}）`);
  }
  return (payload?.data ?? null) as T;
}

/** 默认站点 slug（与 .env.example / lib/site.ts 注释保持一致；缺失时给出显式告警） */
export const DEFAULT_SITE_SLUG = (() => {
  const configured = process.env.NEXT_PUBLIC_DEFAULT_SITE?.trim();
  if (configured) return configured;
  console.warn(
    '[XHCMS] 未配置 NEXT_PUBLIC_DEFAULT_SITE，回退默认站点 "books"。' +
      '若该站点不存在，门户所有未带站点前缀的页面都会 404。',
  );
  return 'books';
})();

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/* ================================================================== */
/* 小说站门户服务端取数                                                 */
/* ================================================================== */

import type {
  ChapterContent,
  NovelCard,
  NovelCatalog,
  NovelDetail,
  PublicCategory,
  PublicNovelComment,
} from '@wmcms/shared';

export interface NovelListQuery {
  page?: number;
  pageSize?: number;
  categorySlug?: string;
  status?: 'serial' | 'completed';
  keyword?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'views' | 'favorites' | 'words';
  order?: 'asc' | 'desc';
  isRecommend?: boolean;
}

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export const novelPortalApi = {
  categories: (siteSlug: string) =>
    serverGet<PublicCategory[]>(`/public/sites/${encodeURIComponent(siteSlug)}/novel-categories`, {
      tags: [`site:${siteSlug}:novel-categories`],
    }),

  novels: (siteSlug: string, query: NovelListQuery = {}) =>
    serverGet<Paginated<NovelCard>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novels${toQueryString(
        query as unknown as Record<string, unknown>,
      )}`,
      { tags: [`site:${siteSlug}:novels`] },
    ),

  detail: (siteSlug: string, novelSlug: string) =>
    serverGet<NovelDetail>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novels/${encodeURIComponent(novelSlug)}`,
      { revalidate: 15, tags: [`site:${siteSlug}:novel:${novelSlug}`] },
    ),

  catalog: (siteSlug: string, novelSlug: string) =>
    serverGet<NovelCatalog>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novels/${encodeURIComponent(novelSlug)}/catalog`,
      { revalidate: 30, tags: [`site:${siteSlug}:novel:${novelSlug}`] },
    ),

  chapter: (siteSlug: string, novelSlug: string, chapterNo: number) =>
    serverGet<ChapterContent>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novels/${encodeURIComponent(novelSlug)}/chapters/${chapterNo}`,
      { revalidate: 0 },
    ),

  rankings: (siteSlug: string, type: 'hot' | 'new' | 'favorite' | 'words' = 'hot', limit = 20) =>
    serverGet<NovelCard[]>(
      `/public/sites/${encodeURIComponent(siteSlug)}/rankings?type=${type}&limit=${limit}`,
      { revalidate: 30, tags: [`site:${siteSlug}:rankings`] },
    ),

  search: (siteSlug: string, q: string, page = 1, pageSize = 12) =>
    serverGet<Paginated<NovelCard>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
      { revalidate: 0 },
    ),

  author: (siteSlug: string, penName: string) =>
    serverGet<{
      penName: string;
      bio: string | null;
      stats: { novelCount: number; chapterCount: number; totalWords: number; totalFavorites: number };
      novels: NovelCard[];
    }>(`/public/sites/${encodeURIComponent(siteSlug)}/authors/${encodeURIComponent(penName)}`, {
      revalidate: 60,
      tags: [`site:${siteSlug}:author:${penName}`],
    }),

  comments: (siteSlug: string, novelId: string, chapterId?: string | null) =>
    serverGet<PublicNovelComment[]>(
      `/public/sites/${encodeURIComponent(siteSlug)}/novel-comments${toQueryString({
        novelId,
        chapterId: chapterId ?? undefined,
      })}`,
      { revalidate: 10 },
    ),
};
