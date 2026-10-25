import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { NovelDetail } from '@wmcms/shared';
import { BookView } from '@/components/portal/server/views/book-view';
import { getPortalContext } from '@/components/portal/server/context';
import { buildBookMetadata } from '@/components/portal/server/metadata';
import { loadPublicResource } from '@/lib/site';

export const revalidate = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; slug: string }>;
}): Promise<Metadata> {
  const { site, slug } = await params;
  const result = await getPortalContext(`/${site}`, site);
  if (result.status !== 'ok') return { title: '书籍' };
  const detail = await loadPublicResource<NovelDetail>(
    `/public/sites/${encodeURIComponent(result.ctx.site.slug)}/novels/${encodeURIComponent(slug)}`,
    { revalidate: 15, tags: [`site:${result.ctx.site.slug}:novel:${slug}`] },
  );
  if (detail.status === 'not-found') notFound();
  if (detail.status !== 'ok') return { title: '书籍' };
  return buildBookMetadata(result.ctx, detail.data, `/book/${slug}`);
}

export default async function PrefixBookPage({
  params,
}: {
  params: Promise<{ site: string; slug: string }>;
}) {
  const { site, slug } = await params;
  return <BookView basePath={`/${site}`} siteSlug={site} slug={slug} />;
}
