import { cache } from 'react';
import { novelPortalApi } from '@/lib/server-api';
import { getPortalSettings, loadSiteBySlug, loadSiteForHost } from '@/lib/site';
import type { PortalContext } from '@/themes/types';

/**
 * 小说门户渲染上下文加载（server-only，请求级缓存）。
 *
 * 同一请求内 Layout / Page / generateMetadata 都会调用它；React cache + Next fetch 缓存保证
 * 站点 / 主题 / 小说分类只真正请求一次。
 *
 * - `siteSlug` 传入时按 slug 解析（`(portal)/[site]` 前缀入口）；
 * - 不传时按请求 Host 解析（`(portal)/(default)` 默认入口）。
 */
export type PortalContextResult =
  | { status: 'ok'; ctx: PortalContext }
  | { status: 'not-found' }
  | { status: 'error' };

export const getPortalContext = cache(
  async (basePath: string, siteSlug?: string): Promise<PortalContextResult> => {
    const siteResult = siteSlug ? await loadSiteBySlug(siteSlug) : await loadSiteForHost();

    if (siteResult.status === 'not-found') return { status: 'not-found' };
    if (siteResult.status === 'error') return { status: 'error' };

    const { site, theme } = siteResult;
    const categories = await novelPortalApi.categories(site.slug);

    const ctx: PortalContext = {
      site,
      theme,
      settings: getPortalSettings(site, theme),
      basePath,
      categories: categories ?? [],
      categoriesAvailable: categories !== null,
    };

    return { status: 'ok', ctx };
  },
);
