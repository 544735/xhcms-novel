import { cache } from 'react';
import { headers } from 'next/headers';
import type { PublicSite, PublicThemePayload, SiteSettings } from '@wmcms/shared';
import { DEFAULT_SITE_SLUG, SITE_URL } from './server-api';

/**
 * 门户站点解析层（server-only，仅被 (portal) 路由与主题使用）。
 *
 * ## 路由方案（重要）
 * 小说门户采用「主机解析 + 前缀强制」双入口：
 * - `(portal)/(default)/**`  →  `/`、`/book/xxx`、`/read/xxx/1` …… 站点由请求 Host 决定；
 * - `(portal)/[site]/**`     →  `/ink`、`/ink/book/xxx` …… 前缀强制指定站点（任意站点 slug 均可）。
 * 两者共用 `components/portal/server/portal-shell.tsx` 的同一套主题外壳，站内链接通过 `basePath`
 * （`''` 或 `/ink`）保持站点上下文，避免在 `/ink` 下点进别的站点。
 * 阅读器（/read/**）单独放在 `(reader)` 分组下，不渲染站点 Header/Footer（沉浸阅读）。
 *
 * 没有采用 `(portal)/[[...path]]` 单文件路由：它会让每个页面自行拆解路径，可维护性差且
 * 无法享受 Next 的路由级缓存与并行数据获取；也没有采用 middleware rewrite（middleware 属
 * Lead 所有权文件，且 rewrite 后 URL 与 canonical 容易漂移）。当前方案的约束是「默认站点两套
 * 目录结构」，用薄路由文件 + 共享视图组件消除重复逻辑。
 *
 * ## Host 匹配
 * 公开接口没有「按域名查站点」的入口，因此域名映射由环境变量提供：
 *   NEXT_PUBLIC_SITE_HOSTS="books.example.com=books,ink.example.com=ink"
 * 未命中时：`*.localhost` 取子域名作为站点 slug（如 ink.localhost），否则回退
 * `NEXT_PUBLIC_DEFAULT_SITE`（默认 books）。这样本地 `http://localhost:3000/` 与
 * `http://localhost:3000/ink` 都能直接预览两个小说站。
 */

const SERVER_API_BASE = (
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000/api/v1'
).replace(/\/+$/, '');

/* ------------------------------------------------------------------ */
/* Host → 站点 slug                                                     */
/* ------------------------------------------------------------------ */

function parseHostMap(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!raw) return map;
  for (const pair of raw.split(',')) {
    const [host, slug] = pair.split('=').map((part) => part?.trim().toLowerCase());
    if (host && slug) map[host] = slug;
  }
  return map;
}

const HOST_TO_SITE = parseHostMap(process.env.NEXT_PUBLIC_SITE_HOSTS);

/** 从 Host 头推导站点 slug（纯函数，便于测试与 Route Handler 复用） */
export function siteSlugFromHost(host: string | null | undefined): string {
  const hostname = (host ?? '').split(':')[0]?.trim().toLowerCase();
  if (!hostname) return DEFAULT_SITE_SLUG;
  if (HOST_TO_SITE[hostname]) return HOST_TO_SITE[hostname];

  // 本地/测试域名：life.localhost → life（127.0.0.1 / localhost 不参与）
  if (/^[a-z0-9-]+\.localhost$/.test(hostname)) {
    return hostname.split('.')[0];
  }
  return DEFAULT_SITE_SLUG;
}

/** 当前请求 Host 对应的站点 slug（同一请求内缓存，Layout / Page / Router Handler 共享） */
export const resolveCurrentSiteSlug = cache(async (): Promise<string> => {
  const host = (await headers()).get('host');
  return siteSlugFromHost(host);
});

/* ------------------------------------------------------------------ */
/* 站点数据加载（能区分 404 与网络错误）                                  */
/* ------------------------------------------------------------------ */

export interface PortalSiteTheme {
  key: string;
  name: string;
  config: Record<string, unknown> | null;
}

export type SiteLoadResult =
  | { status: 'ok'; site: PublicSite; theme: PortalSiteTheme }
  | { status: 'not-found' }
  | { status: 'error' };

type FetchJsonResult<T> = { ok: true; data: T } | { ok: false; status: number | null };

async function fetchJson<T>(
  path: string,
  tags: string[],
  revalidate = 30,
): Promise<FetchJsonResult<T>> {
  try {
    const response = await fetch(`${SERVER_API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate, tags },
    });
    if (!response.ok) return { ok: false, status: response.status };
    const payload = (await response.json()) as { data?: T };
    if (!payload || payload.data === undefined || payload.data === null) {
      return { ok: false, status: response.status };
    }
    return { ok: true, data: payload.data };
  } catch {
    // 网络错误 / API 未启动：与 404 区分，页面走「内容加载失败」兜底而不是 404
    return { ok: false, status: null };
  }
}

/**
 * 按 slug 加载站点（含主题配置），带 Next.js 数据缓存 + 请求级去重。
 * - 404 → not-found（未知站点，页面 notFound()）
 * - 其它失败 → error（页面显示友好兜底，不白屏）
 */
export const loadSiteBySlug = cache(async (slug: string): Promise<SiteLoadResult> => {
  const siteResult = await fetchJson<PublicSite>(
    `/public/sites/${encodeURIComponent(slug)}`,
    [`site:${slug}`],
  );

  if (siteResult.ok !== true) {
    return siteResult.status === 404 ? { status: 'not-found' } : { status: 'error' };
  }

  const site = siteResult.data;
  const siteThemeKey = site.themeKey || 'modern';
  let theme: PortalSiteTheme = { key: siteThemeKey, name: siteThemeKey, config: null };

  // 主题配置是可选增强：失败不影响站点本身可用
  const themeResult = await fetchJson<PublicThemePayload>(
    `/public/sites/${encodeURIComponent(slug)}/theme`,
    [`site:${slug}`, `site:${slug}:theme`],
  );
  if (themeResult.ok === true && themeResult.data.theme) {
    theme = {
      key: siteThemeKey,
      name: themeResult.data.theme.name || siteThemeKey,
      config: themeResult.data.theme.config ?? null,
    };
  }

  return { status: 'ok', site, theme };
});

/** Host 解析出的站点（默认入口使用） */
export async function loadSiteForHost(): Promise<SiteLoadResult> {
  const slug = await resolveCurrentSiteSlug();
  return loadSiteBySlug(slug);
}

export type PublicResourceResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * 需要区分「内容不存在」与「接口不可用」的公开资源加载（文章详情 / 栏目页正文等）。
 * 不存在 → 页面 notFound()；不可用 → 友好兜底，不白屏。
 */
export async function loadPublicResource<T>(
  path: string,
  options: { tags?: string[]; revalidate?: number } = {},
): Promise<PublicResourceResult<T>> {
  const result = await fetchJson<T>(path, options.tags ?? [], options.revalidate ?? 30);
  if (result.ok === true) return { status: 'ok', data: result.data };
  return result.status === 404 ? { status: 'not-found' } : { status: 'error' };
}

/* ------------------------------------------------------------------ */
/* 站点设置（主题注入用）                                                */
/* ------------------------------------------------------------------ */

export interface PortalSettings {
  /** 品牌主色（hex，#rrggbb） */
  primaryColor: string;
  heroTitle: string;
  heroSubtitle: string;
  copyright: string;
  icp: string;
  /** 每页条数（书库/搜索列表） */
  pageSize: number;
  /** 首页模块顺序（settings.homeModules） */
  homeModules: string[];
  /** 评论是否需要审核（书评/章评提示文案） */
  commentAudit: boolean;
}

const THEME_FALLBACK_PRIMARY: Record<string, string> = {
  modern: '#4f46e5',
  magazine: '#b45309',
  minimal: '#334155',
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

/** 站点 settings + theme.config 合并为当前渲染需要的配置（settings 优先级更高） */
export function getPortalSettings(
  site: PublicSite,
  theme: PortalSiteTheme,
): PortalSettings {
  const settings = (site.settings ?? {}) as SiteSettings & Record<string, unknown>;
  const themeConfig = (theme.config ?? {}) as Record<string, unknown>;

  const pick = (key: string): string | undefined =>
    asString(settings[key]) ?? asString(themeConfig[key]);

  const themeKey = theme.key || site.themeKey || 'modern';
  const primaryColor =
    pick('primaryColor') ?? THEME_FALLBACK_PRIMARY[themeKey] ?? THEME_FALLBACK_PRIMARY.modern;

  const homeModules = Array.isArray(settings.homeModules)
    ? (settings.homeModules as unknown[]).filter((item): item is string => typeof item === 'string')
    : Array.isArray(themeConfig.homeModules)
      ? (themeConfig.homeModules as unknown[]).filter((item): item is string => typeof item === 'string')
      : ['hero', 'recommend', 'categories', 'latest', 'rank', 'completed'];

  const rawPageSize = asNumber(settings.pageSize) ?? asNumber(themeConfig.pageSize) ?? 12;

  return {
    primaryColor,
    heroTitle: pick('heroTitle') ?? site.name,
    heroSubtitle: pick('heroSubtitle') ?? site.description ?? '',
    copyright:
      pick('copyright') ?? `© ${new Date().getFullYear()} ${site.name}. 保留所有权利。`,
    icp: pick('icp') ?? '',
    pageSize: Math.min(50, Math.max(1, Math.round(rawPageSize))),
    homeModules,
    commentAudit: settings.commentAudit !== false,
  };
}

/* ------------------------------------------------------------------ */
/* URL 工具                                                             */
/* ------------------------------------------------------------------ */

/** 拼接门户站内路径：portalPath('/life', '/article/x') → '/life/article/x' */
export function portalPath(basePath: string, pathname = ''): string {
  const base = basePath.replace(/\/+$/, '');
  if (!pathname || pathname === '/') return base || '/';
  const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${suffix}` || '/';
}

/** 绝对 URL（canonical / OG / sitemap 用） */
export function portalUrl(basePath: string, pathname = ''): string {
  return `${SITE_URL.replace(/\/+$/, '')}${portalPath(basePath, pathname)}`;
}

/**
 * 把后端 XML（sitemap / rss）中的绝对链接改写到门户域名。
 * 后端按其自身 PUBLIC_SITE_URL 生成链接（开发环境常是 :4000），门户转发时统一改写为
 * NEXT_PUBLIC_SITE_URL，保证 sitemap/RSS 里的 <loc>/<link> 指向真实前台地址。
 */
export function rewriteXmlOrigins(xml: string): string {
  const portalOrigin = SITE_URL.replace(/\/+$/, '');
  const apiOrigin = (() => {
    try {
      return new URL(SERVER_API_BASE).origin;
    } catch {
      return 'http://localhost:4000';
    }
  })();
  return xml
    .split(apiOrigin)
    .join(portalOrigin)
    .split('http://localhost:4000')
    .join(portalOrigin)
    .split('http://127.0.0.1:4000')
    .join(portalOrigin);
}

/** 列表页分页 URL（第 1 页不带 query） */
export function pageUrl(basePath: string, pathname: string, page: number): string {
  const href = portalPath(basePath, pathname);
  if (page <= 1) return href;
  return `${href}${href.includes('?') ? '&' : '?'}page=${page}`;
}

/**
 * 带查询参数的门户链接（保留站点前缀）：用于书库筛选、排行榜 Tab 等。
 * 空值参数自动忽略，第 1 页不输出 page。
 */
export function portalQueryUrl(
  basePath: string,
  pathname: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (key === 'page' && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const href = portalPath(basePath, pathname);
  const serialized = search.toString();
  if (!serialized) return href;
  return `${href}${href.includes('?') ? '&' : '?'}${serialized}`;
}

/* ------------------------------------------------------------------ */
/* 颜色 / CSS 变量                                                       */
/* ------------------------------------------------------------------ */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** #rgb / #rrggbb → HSL（解析失败返回 null） */
export function hexToHsl(hex: string): Hsl | null {
  const value = hex.trim().replace(/^#/, '');
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function triplet(h: number, s: number, l: number): string {
  return `${h} ${Math.min(100, Math.max(0, Math.round(s)))}% ${Math.min(100, Math.max(0, Math.round(l)))}%`;
}

/**
 * 站点品牌色 → CSS 变量（浅色 + 深色两套）。
 * 返回注入到 <style> 的文本：`.portal-theme{...} .dark .portal-theme{...}`
 * 变量会作用于整个主题外壳（含 fixed 元素，因为它们是 DOM 后代）。
 */
export function buildThemeCssVars(primaryColor: string): string {
  const hsl = hexToHsl(primaryColor) ?? { h: 243, s: 75, l: 59 };
  const { h, s, l } = hsl;

  // 深色模式：低亮度品牌色需要提亮，保证在深底上的可读性
  const darkL = l < 55 ? Math.min(72, l + 22) : Math.min(82, Math.max(l, 62));
  const darkS = Math.min(100, Math.round(s * 0.95));
  const lightFg = l < 62 ? '0 0% 100%' : '222 47% 11%';
  const darkFg = darkL > 62 ? '224 45% 8%' : '0 0% 100%';

  return [
    `.portal-theme{--primary:${triplet(h, s, l)};--primary-foreground:${lightFg};--ring:${triplet(h, s, l)};--accent:${triplet(h, Math.max(25, s * 0.75), 96)};--accent-foreground:${triplet(h, Math.max(45, s), 38)};}`,
    `.dark .portal-theme{--primary:${triplet(h, darkS, darkL)};--primary-foreground:${darkFg};--ring:${triplet(h, darkS, darkL)};--accent:${triplet(h, Math.max(30, s * 0.6), 20)};--accent-foreground:${triplet(h, Math.max(50, s), 85)};}`,
  ].join('');
}

/** 主题 key 归一化，未知主题回退 modern */
export function normalizeThemeKey(themeKey: string | null | undefined): 'modern' | 'magazine' | 'minimal' {
  if (themeKey === 'magazine' || themeKey === 'minimal') return themeKey;
  return 'modern';
}
