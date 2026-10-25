import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ChapterContent } from '@wmcms/shared';
import { ReaderView } from '@/components/portal/server/views/reader-view';
import { getPortalContext } from '@/components/portal/server/context';
import { buildChapterMetadata } from '@/components/portal/server/metadata';
import { loadPublicResource } from '@/lib/site';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; novelSlug: string; chapterNo: string }>;
}): Promise<Metadata> {
  const { site, novelSlug, chapterNo } = await params;
  const chapterNumber = Number.parseInt(chapterNo, 10);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) return { title: '阅读' };
  const result = await getPortalContext(`/${site}`, site);
  if (result.status !== 'ok') return { title: '阅读' };
  const chapter = await loadPublicResource<ChapterContent>(
    `/public/sites/${encodeURIComponent(result.ctx.site.slug)}/novels/${encodeURIComponent(novelSlug)}/chapters/${chapterNumber}`,
    { revalidate: 0 },
  );
  if (chapter.status === 'not-found') notFound();
  if (chapter.status !== 'ok') return { title: '阅读' };
  return buildChapterMetadata(result.ctx, chapter.data, `/read/${novelSlug}/${chapterNumber}`);
}

export default async function PrefixReadPage({
  params,
}: {
  params: Promise<{ site: string; novelSlug: string; chapterNo: string }>;
}) {
  const { site, novelSlug, chapterNo } = await params;
  const chapterNumber = Number.parseInt(chapterNo, 10);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) notFound();
  return (
    <ReaderView
      basePath={`/${site}`}
      siteSlug={site}
      novelSlug={novelSlug}
      chapterNo={chapterNumber}
    />
  );
}
