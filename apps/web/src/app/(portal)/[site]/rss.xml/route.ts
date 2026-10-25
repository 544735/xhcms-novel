import { portalApi, SITE_URL } from '@/lib/server-api';
import { prefixXmlPaths, rewriteXmlOrigins } from '@/lib/site';

/**
 * 前缀站点（`/ink` 等）的 RSS 2.0：转发后端 `public/sites/:slug/rss.xml`，
 * 再把源站改写到门户域名并补上 `/{site}` 前缀，保证订阅器拿到的是前缀站点自己的链接。
 */
export const dynamic = 'force-dynamic';

/** 站点 slug 白名单：拒绝 `%0A` / 空格 / 尖括号等会导致 XML 被注入的取值 */
const SITE_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fallbackRss(siteSlug: string, basePath: string): string {
  const base = `${SITE_URL.replace(/\/+$/, '')}${basePath}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXmlText(`${siteSlug} 小说更新`)}</title>`,
    `<link>${escapeXmlText(base)}</link>`,
    '<description>内容暂时不可用</description>',
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    '</channel>',
    '</rss>',
  ].join('');
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ site: string }> },
): Promise<Response> {
  const { site } = await context.params;
  if (!SITE_SLUG_PATTERN.test(site)) {
    return new Response('Not Found', { status: 404 });
  }

  const basePath = `/${site}`;
  const xml = await portalApi.rssXml(site);
  const body = xml?.includes('<rss')
    ? prefixXmlPaths(rewriteXmlOrigins(xml), basePath)
    : fallbackRss(site, basePath);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=120',
      'X-Wmcms-Site': site,
    },
  });
}
