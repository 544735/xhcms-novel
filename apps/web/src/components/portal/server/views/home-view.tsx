import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, Flame, Sparkles, Star, TrendingUp } from 'lucide-react';
import { novelPortalApi } from '@/lib/server-api';
import { getTheme } from '@/themes';
import { CategoryChips, SectionHeading } from '@/themes/shared';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';

/**
 * 小说站首页：Hero（标题/副标题/搜索/热榜/推荐）→ 分类入口 → 最新更新 → 完结好书 → 三榜速览。
 * 所有数据走 novelPortalApi（服务端 + ISR 数据缓存），失败时分区兜底，不整页白屏。
 */
export async function HomeView({
  basePath,
  siteSlug,
}: {
  basePath: string;
  siteSlug?: string;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const slug = ctx.site.slug;

  const [recommendedData, latestData, hotData, newData, favoriteData, completedData] =
    await Promise.all([
      novelPortalApi.novels(slug, { isRecommend: true, pageSize: 8, sortBy: 'updatedAt' }),
      novelPortalApi.novels(slug, { page: 1, pageSize: 10, sortBy: 'updatedAt', order: 'desc' }),
      novelPortalApi.rankings(slug, 'hot', 8),
      novelPortalApi.rankings(slug, 'new', 6),
      novelPortalApi.rankings(slug, 'favorite', 6),
      novelPortalApi.novels(slug, { status: 'completed', pageSize: 5, sortBy: 'favorites' }),
    ]);

  const recommended = recommendedData?.items ?? [];
  const latest = latestData?.items ?? [];
  const hot = hotData ?? [];
  const newBooks = newData ?? [];
  const favorite = favoriteData ?? [];
  const completed = completedData?.items ?? [];
  const novelCount = latestData?.total ?? recommendedData?.total ?? 0;

  const allFailed = !recommendedData && !latestData && !hotData;
  if (allFailed) {
    return (
      <div className="container py-12">
        <PortalLoadError basePath={basePath} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <theme.Hero ctx={ctx} recommended={recommended} latest={latest} hot={hot} novelCount={novelCount} />

      <section className="border-t border-border">
        <div className="container py-10">
          <SectionHeading
            title="分类找书"
            description="按题材挑一本开始读"
            href={`${basePath}/books`}
            hrefLabel="进入书库"
            icon={<BookOpen className="h-4 w-4" />}
            className="mb-5"
          />
          <CategoryChips ctx={ctx} />
        </div>
      </section>

      <section className="container py-10">
        <SectionHeading
          title="最新更新"
          description="每日上新与追更"
          href={`${basePath}/books`}
          hrefLabel="全部书籍"
          icon={<TrendingUp className="h-4 w-4" />}
          className="mb-5"
        />
        {latestData === null ? (
          <PortalLoadError basePath={basePath} compact />
        ) : (
          <theme.BookGrid ctx={ctx} novels={latest} emptyText="书城还没有上架书籍" />
        )}
      </section>

      {completed.length ? (
        <section className="border-t border-border">
          <div className="container py-10">
            <SectionHeading
              title="完结好书"
              description="一口气读到结局"
              href={`${basePath}/books?status=completed`}
              hrefLabel="全部完结"
              icon={<Star className="h-4 w-4" />}
              className="mb-5"
            />
            <theme.BookGrid ctx={ctx} novels={completed} variant="wide" emptyText="暂无完结作品" />
          </div>
        </section>
      ) : null}

      <section className="border-t border-border">
        <div className="container py-10">
          <SectionHeading
            title="榜单速览"
            description="热门 / 新书 / 收藏"
            href={`${basePath}/rank`}
            hrefLabel="完整榜单"
            icon={<Flame className="h-4 w-4" />}
            className="mb-5"
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              { key: 'hot', title: '热门榜', items: hot, icon: <Flame className="h-3.5 w-3.5 text-warning" /> },
              { key: 'new', title: '新书榜', items: newBooks, icon: <Sparkles className="h-3.5 w-3.5 text-primary" /> },
              { key: 'favorite', title: '收藏榜', items: favorite, icon: <Star className="h-3.5 w-3.5 text-warning" /> },
            ].map((group) => (
              <div key={group.key} className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {group.icon}
                  {group.title}
                </p>
                {group.items.length ? (
                  <div>
                    {group.items.slice(0, 6).map((novel, index) => (
                      <theme.BookCard
                        key={novel.id}
                        ctx={ctx}
                        novel={novel}
                        variant="compact"
                        rank={index + 1}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">榜单更新中</p>
                )}
                <Link
                  href={`${basePath}/rank?type=${group.key}`}
                  className="mt-2 inline-flex text-[11px] text-muted-foreground hover:text-primary"
                >
                  查看更多 →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
