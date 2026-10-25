import { portalApi, SITE_URL } from '@/lib/server-api';
import { resolveCurrentSiteSlug, rewriteXmlOrigins } from '@/lib/site';

/**
 * 小说站点地图：转发后端 `public/sites/:slug/sitemap.xml`
 * （书籍 / 章节 / 分类 / 排行 / 作者 URL，@RawResponse 原始 XML）。
 * 站点由 Host 解析（与页面同一套规则）；XML 内的绝对链接统一改写为门户域名。
 * 后端不可用时返回只含首页的最小合法 sitemap，避免 404。
 * 注：Next 的 app/sitemap.ts 只能生成固定结构，无法透传后端生成的完整书籍/章节 URL，故用 Route Handler。
 */
export const dynamic = 'force-dynamic';

function fallbackSitemap(): string {
  const base = SITE_URL.replace(/\/+$/, '');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${base}/books</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${base}/rank</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    '</urlset>',
  ].join('');
}

export async function GET() {
  const slug = await resolveCurrentSiteSlug();
  const xml = await portalApi.sitemapXml(slug);
  const body =
    xml && (xml.includes('<urlset') || xml.trimStart().startsWith('<?xml'))
      ? rewriteXmlOrigins(xml)
      : fallbackSitemap();

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=120',
      'X-Wmcms-Site': slug,
    },
  });
}
