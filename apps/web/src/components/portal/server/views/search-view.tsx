import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Search } from 'lucide-react';
import { novelPortalApi } from '@/lib/server-api';
import { getTheme } from '@/themes';
import { CategoryChips, EmptyNotice, PaginationLinks, SectionHeading } from '@/themes/shared';
import { SearchForm } from '@/components/portal/server/client/search-form';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';

/**
 * 搜索页 /search?q=：无关键词时展示搜索引导 + 热门书 + 分类；有关键词时展示分页结果。
 */
export async function SearchView({
  basePath,
  siteSlug,
  q,
  page,
}: {
  basePath: string;
  siteSlug?: string;
  q: string;
  page: number;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const keyword = q.trim();
  const pageSize = ctx.settings.pageSize;

  if (!keyword) {
    const [hot, latest] = await Promise.all([
      novelPortalApi.rankings(ctx.site.slug, 'hot', 8),
      novelPortalApi.novels(ctx.site.slug, { pageSize: 6, sortBy: 'updatedAt' }),
    ]);
    return (
      <div className="container py-12">
        <div className="mx-auto max-w-2xl space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Search className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">搜书</h1>
            <p className="text-sm text-muted-foreground">输入书名或作者笔名，找到想读的故事。</p>
          </div>
          <div className="flex justify-center">
            <SearchForm basePath={basePath} variant="hero" />
          </div>
        </div>

        {hot?.length ? (
          <div className="mx-auto mt-12 max-w-4xl">
            <SectionHeading title="热门搜索" className="mb-4" />
            <theme.BookGrid ctx={ctx} novels={hot} variant="wide" />
          </div>
        ) : null}

        {latest?.items?.length ? (
          <div className="mx-auto mt-10 max-w-4xl border-t border-border pt-8">
            <SectionHeading title="最新上架" className="mb-4" />
            <theme.BookGrid ctx={ctx} novels={latest.items} variant="wide" />
          </div>
        ) : null}

        <div className="mx-auto mt-10 max-w-4xl border-t border-border pt-6">
          <p className="mb-3 text-xs font-medium text-muted-foreground">按分类找书</p>
          <CategoryChips ctx={ctx} />
        </div>
      </div>
    );
  }

  const data = await novelPortalApi.search(ctx.site.slug, keyword, page, pageSize);

  return (
    <div className="container py-8">
      <header className="mb-8 space-y-3 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">搜索</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          “{keyword}” 的搜索结果
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <SearchForm basePath={basePath} defaultValue={keyword} variant="inline" className="w-full sm:w-80" />
          {data ? <p className="text-xs text-muted-foreground">共找到 {data.total} 本书</p> : null}
        </div>
      </header>

      {data === null ? (
        <PortalLoadError basePath={basePath} compact />
      ) : data.items.length ? (
        <>
          <theme.BookGrid ctx={ctx} novels={data.items} />
          <PaginationLinks
            page={page}
            total={data.total}
            pageSize={data.pageSize || pageSize}
            basePath={basePath}
            pathname="/search"
            query={{ q: keyword }}
            className="mt-10 border-t border-border pt-4"
          />
        </>
      ) : (
        <div className="space-y-6">
          <EmptyNotice text={`没有找到与“${keyword}”相关的书籍，换个关键词试试`} />
          <div className="text-center">
            <Link href={`${basePath}/books`} className="text-sm text-primary hover:underline">
              去书库逛逛 →
            </Link>
          </div>
        </div>
      )}

      <div className="mt-10 border-t border-border pt-6">
        <p className="mb-3 text-xs font-medium text-muted-foreground">按分类找书</p>
        <CategoryChips ctx={ctx} />
      </div>
    </div>
  );
}
