import { SITE_URL } from '@/lib/server-api';

/**
 * robots.txt：小说站门户可抓取（含书籍 / 阅读页），后台与会员相关页面禁止抓取；指向本站 sitemap。
 * 站点地图由 Host 解析，因此 sitemap 仍用站点根地址（多域名部署时按部署域名切换）。
 */
export const dynamic = 'force-static';

export function GET() {
  const base = SITE_URL.replace(/\/+$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    'Allow: /books',
    'Allow: /book/',
    'Allow: /read/',
    'Disallow: /admin',
    'Disallow: /member',
    'Disallow: /vip',
    'Disallow: /shelf',
    'Disallow: /history',
    'Disallow: /author-center',
    'Disallow: /search',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
