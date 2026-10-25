import { portalApi, SITE_URL } from '@/lib/server-api';
import { prefixXmlPaths, rewriteXmlOrigins } from '@/lib/site';

/**
 * 前缀站点（`/ink` 等）的 sitemap.xml：转发后端 `public/sites/:slug/sitemap.xml`，
 * 再做两步改写：
 * 1. `rewriteXmlOrigins` 把 API 源站改成门户域名；
 * 2. `prefixXmlPaths` 给每条链接补上 `/{site}` 前缀，避免把爬虫指回默认站点。
 *
 * 站点 slug 来自路径段而非 Host，因此与 `[site]` 页面入口永远指向同一个站点。
 */
export const dynamic = 'force-dynamic';

/** 站点 slug 白名单：拒绝 `%0A` / 空格 / 尖括号等会导致 XML 或 robots 被注入的取值 */
const SITE_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fallbackSitemap(basePath: string): string {
  const base = escapeXmlText(`${SITE_URL.replace(/\/+$/, '')}${basePath}`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `<url><loc>${base}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${base}/books</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${base}/rank</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    '</urlset>',
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
  const xml = await portalApi.sitemapXml(site);
  const body =
    xml && (xml.includes('<urlset') || xml.trimStart().startsWith('<?xml'))
      ? prefixXmlPaths(rewriteXmlOrigins(xml), basePath)
      : fallbackSitemap(basePath);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=120',
      'X-Wmcms-Site': site,
    },
  });
}
