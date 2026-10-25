import { portalApi, SITE_URL } from '@/lib/server-api';
import { resolveCurrentSiteSlug, rewriteXmlOrigins } from '@/lib/site';

/**
 * 小说站 RSS 2.0：转发后端 `public/sites/:slug/rss.xml`（最新章节更新），绝对链接改写为门户域名。
 * 后端不可用时返回最小合法 RSS，保证订阅器不会拿到 404/HTML。
 */
export const dynamic = 'force-dynamic';

function fallbackRss(siteSlug: string): string {
  const base = SITE_URL.replace(/\/+$/, '');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${siteSlug} 小说更新</title>`,
    `<link>${base}/</link>`,
    '<description>内容暂时不可用</description>',
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    '</channel>',
    '</rss>',
  ].join('');
}

export async function GET() {
  const slug = await resolveCurrentSiteSlug();
  const xml = await portalApi.rssXml(slug);
  const body = xml?.includes('<rss') ? rewriteXmlOrigins(xml) : fallbackRss(slug);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=120',
      'X-Wmcms-Site': slug,
    },
  });
}
