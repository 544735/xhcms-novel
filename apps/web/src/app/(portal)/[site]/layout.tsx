import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortalShell } from '@/components/portal/server/portal-shell';
import { getPortalContext } from '@/components/portal/server/context';
import { buildSiteMetadata } from '@/components/portal/server/metadata';

/**
 * 前缀站点入口：`/ink`、`/ink/book/xxx`、`/ink/read/xxx/1`、`/ink/member` …
 * `[site]` 为任意站点 slug（不局限于 ink），用于本地同时预览多个小说站；未知 slug 返回 404。
 */
export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string }>;
}): Promise<Metadata> {
  const { site } = await params;
  const result = await getPortalContext(`/${site}`, site);
  // 在 metadata 阶段就判定 404：此时响应尚未开始流式输出，能正确返回 HTTP 404
  if (result.status === 'not-found') notFound();
  if (result.status !== 'ok') {
    return { title: '站点暂时不可用', robots: { index: false, follow: false } };
  }
  return buildSiteMetadata(result.ctx);
}

export default async function PrefixPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  return (
    <PortalShell basePath={`/${site}`} siteSlug={site}>
      {children}
    </PortalShell>
  );
}
