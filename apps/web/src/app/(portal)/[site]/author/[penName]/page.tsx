import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { NovelCard } from '@wmcms/shared';
import { AuthorView } from '@/components/portal/server/views/author-view';
import { getPortalContext } from '@/components/portal/server/context';
import { buildAuthorMetadata } from '@/components/portal/server/metadata';
import { loadPublicResource } from '@/lib/site';
import { safeDecodeParam } from '@/components/portal/server/utils';

export const revalidate = 60;

interface PublicAuthor {
  penName: string;
  bio: string | null;
  stats: { novelCount: number; chapterCount: number; totalWords: number; totalFavorites: number };
  novels: NovelCard[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; penName: string }>;
}): Promise<Metadata> {
  const { site, penName } = await params;
  const decoded = safeDecodeParam(penName);
  const result = await getPortalContext(`/${site}`, site);
  if (result.status !== 'ok') return { title: '作者' };
  const author = await loadPublicResource<PublicAuthor>(
    `/public/sites/${encodeURIComponent(result.ctx.site.slug)}/authors/${encodeURIComponent(decoded)}`,
    { revalidate: 60 },
  );
  if (author.status === 'not-found') notFound();
  if (author.status !== 'ok') return { title: '作者' };
  return buildAuthorMetadata(result.ctx, author.data, `/author/${encodeURIComponent(decoded)}`);
}

export default async function PrefixAuthorPage({
  params,
}: {
  params: Promise<{ site: string; penName: string }>;
}) {
  const { site, penName } = await params;
  return <AuthorView basePath={`/${site}`} siteSlug={site} penName={safeDecodeParam(penName)} />;
}
