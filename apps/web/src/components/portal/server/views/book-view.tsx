import { notFound } from 'next/navigation';
import type { NovelDetail } from '@wmcms/shared';
import { novelPortalApi } from '@/lib/server-api';
import { loadPublicResource } from '@/lib/site';
import { getTheme } from '@/themes';
import { CommentSection } from '@/components/portal/client/comment-section';
import { BookActions } from '@/components/portal/server/client/book-actions';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';

/**
 * 书籍详情 /book/[slug]：封面 / 作者 / 状态 / 字数 / 人气 / 收藏（客户端书架）/ 最新章节 /
 * 分卷目录 / 开始阅读 / 书评（服务端已审核树 + 客户端评论组件）。
 * 注：会员态（书架、解锁）只存在浏览器 localStorage，服务端渲染时按匿名态处理，
 * 客户端组件挂载后再校正（BookActions / CommentSection）。
 */
export async function BookView({
  basePath,
  siteSlug,
  slug,
}: {
  basePath: string;
  siteSlug?: string;
  slug: string;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const site = ctx.site.slug;

  const detailResult = await loadPublicResource<NovelDetail>(
    `/public/sites/${encodeURIComponent(site)}/novels/${encodeURIComponent(slug)}`,
    { revalidate: 15, tags: [`site:${site}:novel:${slug}`] },
  );

  if (detailResult.status === 'not-found') notFound();
  if (detailResult.status === 'error') return <PortalLoadError basePath={basePath} />;

  const detail = detailResult.data;

  // 详情接口通常已带分卷目录；为空时再拉一次 catalog 兜底
  let novel: NovelDetail = detail;
  if (!novel.volumes?.length) {
    const catalog = await novelPortalApi.catalog(site, slug);
    if (catalog?.volumes?.length) {
      novel = { ...novel, volumes: catalog.volumes };
    }
  }

  const comments = (await novelPortalApi.comments(site, novel.id)) ?? [];

  const firstChapterNo =
    novel.firstChapter?.chapterNo ?? novel.volumes?.[0]?.chapters?.[0]?.chapterNo ?? null;
  const progressChapterNo = novel.progress?.chapterNo ?? null;

  const startReadingHref =
    progressChapterNo !== null
      ? `${basePath}/read/${novel.slug}/${progressChapterNo}`
      : firstChapterNo !== null
        ? `${basePath}/read/${novel.slug}/${firstChapterNo}`
        : `${basePath}/book/${novel.slug}`;
  const startReadingLabel = progressChapterNo !== null ? `继续阅读 第 ${progressChapterNo} 章` : firstChapterNo !== null ? '开始阅读' : '暂无章节';

  const commentSection = (
    <CommentSection
      siteSlug={site}
      novelId={novel.id}
      comments={comments}
      basePath={basePath}
      title="书评"
    />
  );
  const bookActions = (
    <BookActions siteSlug={site} novelId={novel.id} basePath={basePath} initialInBookshelf={novel.inBookshelf} />
  );

  return (
    <theme.BookDetail
      ctx={ctx}
      novel={novel}
      comments={comments}
      commentSection={commentSection}
      bookActions={bookActions}
      startReadingHref={startReadingHref}
      startReadingLabel={startReadingLabel}
    />
  );
}
