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
  params: Promise<{ novelSlug: string; chapterNo: string }>;
}): Promise<Metadata> {
  const { novelSlug, chapterNo } = await params;
  const chapterNumber = Number.parseInt(chapterNo, 10);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) return { title: '阅读' };
  const result = await getPortalContext('');
  if (result.status !== 'ok') return { title: '阅读' };
  const chapter = await loadPublicResource<ChapterContent>(
    `/public/sites/${encodeURIComponent(result.ctx.site.slug)}/novels/${encodeURIComponent(novelSlug)}/chapters/${chapterNumber}`,
    { revalidate: 0 },
  );
  if (chapter.status === 'not-found') notFound();
  if (chapter.status !== 'ok') return { title: '阅读' };
  return buildChapterMetadata(result.ctx, chapter.data, `/read/${novelSlug}/${chapterNumber}`);
}

export default async function PortalReadPage({
  params,
}: {
  params: Promise<{ novelSlug: string; chapterNo: string }>;
}) {
  const { novelSlug, chapterNo } = await params;
  const chapterNumber = Number.parseInt(chapterNo, 10);
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) notFound();
  return <ReaderView basePath="" novelSlug={novelSlug} chapterNo={chapterNumber} />;
}
