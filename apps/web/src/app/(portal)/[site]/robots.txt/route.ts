import { SITE_URL } from '@/lib/server-api';

/**
 * 前缀站点（`/ink` 等）的 robots.txt。
 *
 * 根级 `(portal)/robots.txt` 只有一份、且 Sitemap 指向 Host 解析出的站点；
 * 前缀站点必须有自己的 robots：抓取/屏蔽路径带 `/{site}` 前缀，Sitemap 指向
 * `/{site}/sitemap.xml`（由同目录下的 sitemap.xml/route.ts 提供）。
 */
export const dynamic = 'force-dynamic';

/** 站点 slug 白名单：拒绝 `%0A` / 空格等会向 robots.txt 注入额外指令的取值 */
const SITE_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ site: string }> },
): Promise<Response> {
  const { site } = await context.params;
  if (!SITE_SLUG_PATTERN.test(site)) {
    return new Response('Not Found', { status: 404 });
  }

  const base = SITE_URL.replace(/\/+$/, '');
  const prefix = `/${site}`;
  const body = [
    'User-agent: *',
    'Allow: /',
    `Allow: ${prefix}`,
    `Allow: ${prefix}/books`,
    `Allow: ${prefix}/book/`,
    `Allow: ${prefix}/read/`,
    `Disallow: ${prefix}/member`,
    `Disallow: ${prefix}/vip`,
    `Disallow: ${prefix}/shelf`,
    `Disallow: ${prefix}/history`,
    `Disallow: ${prefix}/author-center`,
    `Disallow: ${prefix}/search`,
    '',
    `Sitemap: ${base}${prefix}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=120',
    },
  });
}
