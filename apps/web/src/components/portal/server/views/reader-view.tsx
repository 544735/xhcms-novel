import { notFound } from 'next/navigation';
import type { ChapterContent } from '@wmcms/shared';
import { novelPortalApi } from '@/lib/server-api';
import { loadPublicResource } from '@/lib/site';
import { getTheme } from '@/themes';
import { CommentSection } from '@/components/portal/client/comment-section';
import { ReaderShell } from '@/components/portal/server/client/reader-shell';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';

/**
 * 阅读器 /read/[novelSlug]/[chapterNo]：
 * - SSR 用 novelPortalApi.chapter 取正文（VIP 未解锁时返回 locked + preview，页面直接渲染锁定态）；
 * - 页面位于外壳 layout 中，但 PortalChrome 会识别 /read 路径并隐藏站点 Header/Footer；
 * - ReaderShell（客户端）负责字号/行高/背景/宽度、目录抽屉、上下章、阅读进度上报、解锁与登录入口。
 */
export async function ReaderView({
  basePath,
  siteSlug,
  novelSlug,
  chapterNo,
}: {
  basePath: string;
  siteSlug?: string;
  novelSlug: string;
  chapterNo: number;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const site = ctx.site.slug;

  const chapterResult = await loadPublicResource<ChapterContent>(
    `/public/sites/${encodeURIComponent(site)}/novels/${encodeURIComponent(novelSlug)}/chapters/${chapterNo}`,
    { revalidate: 0 },
  );

  if (chapterResult.status === 'not-found') notFound();
  if (chapterResult.status === 'error') return <PortalLoadError basePath={basePath} />;

  const chapter = chapterResult.data;

  const [catalog, comments] = await Promise.all([
    novelPortalApi.catalog(site, novelSlug),
    novelPortalApi.comments(site, chapter.novelId, chapter.id),
  ]);

  const commentSection = (
    <CommentSection
      siteSlug={site}
      novelId={chapter.novelId}
      chapterId={chapter.id}
      comments={comments ?? []}
      basePath={basePath}
      title="章评"
    />
  );

  return (
    <ReaderShell
      siteSlug={site}
      siteName={ctx.site.name}
      basePath={basePath}
      novelTitle={chapter.novelTitle}
      novelSlug={novelSlug}
      chapter={chapter}
      catalog={catalog}
      skin={theme.readerSkin}
      commentSection={commentSection}
    />
  );
}
