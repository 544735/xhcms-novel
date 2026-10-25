import { notFound } from 'next/navigation';
import { loadSiteBySlug, loadSiteForHost } from '@/lib/site';

/**
 * 会员相关路由（service 端）的站点上下文解析。
 *
 * 两套入口共用同一个视图组件：
 * - `(portal)/(default)/**`：由请求 Host 解析站点，`basePath = ''`；
 * - `(portal)/[site]/**`：由路径前缀强制站点，`basePath = '/<site>'`。
 *
 * 这里只取站点基础信息（slug / name）用于会员接口与站内链接，不重复加载主题/栏目，
 * 主题外壳由上层 PortalShell 负责。
 */
export interface MemberRouteSite {
  siteSlug: string;
  basePath: string;
  siteName: string;
}

export async function resolveMemberRouteSite(siteParam?: string): Promise<MemberRouteSite> {
  const result = siteParam ? await loadSiteBySlug(siteParam) : await loadSiteForHost();

  if (result.status === 'not-found') notFound();
  if (result.status !== 'ok') {
    throw new Error('站点信息加载失败，请稍后重试');
  }

  return {
    siteSlug: result.site.slug,
    basePath: siteParam ? `/${siteParam}` : '',
    siteName: result.site.name,
  };
}
