import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { novelPortalApi } from '@/lib/server-api';
import { portalQueryUrl } from '@/lib/site';
import { getTheme } from '@/themes';
import { CategoryChips, EmptyNotice, PaginationLinks, SiteBreadcrumb } from '@/themes/shared';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';
import { findCategoryBySlug } from '../utils';

export type BookSort = 'updatedAt' | 'views' | 'favorites' | 'words' | 'createdAt';
export type BookStatus = '' | 'serial' | 'completed';

export interface BooksFilters {
  page: number;
  keyword: string;
  category: string;
  status: BookStatus;
  sortBy: BookSort;
}

const SORT_OPTIONS: { value: BookSort; label: string }[] = [
  { value: 'updatedAt', label: '最近更新' },
  { value: 'views', label: '人气最高' },
  { value: 'favorites', label: '收藏最多' },
  { value: 'words', label: '字数最多' },
  { value: 'createdAt', label: '最新上架' },
];

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'serial', label: '连载中' },
  { value: 'completed', label: '已完结' },
];

/** 书库列表 /books：分类 + 状态 + 排序 + 关键词 + 分页（筛选用 Link 驱动，SEO 友好） */
export async function BooksView({
  basePath,
  siteSlug,
  filters,
}: {
  basePath: string;
  siteSlug?: string;
  filters: BooksFilters;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const pageSize = ctx.settings.pageSize;

  const categoryNode = filters.category ? findCategoryBySlug(ctx.categories, filters.category) : null;
  if (filters.category && ctx.categoriesAvailable && !categoryNode) notFound();

  const data = await novelPortalApi.novels(ctx.site.slug, {
    page: filters.page,
    pageSize,
    keyword: filters.keyword || undefined,
    categorySlug: filters.category || undefined,
    status: filters.status || undefined,
    sortBy: filters.sortBy,
    order: 'desc',
  });

  const listHref = (overrides: Partial<BooksFilters>) => {
    const next = { ...filters, ...overrides };
    return portalQueryUrl(basePath, '/books', {
      keyword: next.keyword || undefined,
      category: next.category || undefined,
      status: next.status || undefined,
      sortBy: next.sortBy === 'updatedAt' ? undefined : next.sortBy,
      page: next.page,
    });
  };

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      active
        ? 'border-primary bg-primary/10 font-medium text-primary'
        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
    }`;

  return (
    <div className="container py-8">
      <SiteBreadcrumb
        items={[{ label: '首页', href: basePath || '/' }, { label: '书库' }]}
      />

      <header className="mb-6 space-y-2 border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {categoryNode ? categoryNode.name : '全部书籍'}
        </h1>
        <p className="text-xs text-muted-foreground">
          共 {data?.total ?? 0} 本
          {filters.keyword ? ` · 关键词「${filters.keyword}」` : ''}
        </p>
      </header>

      {/* 搜索 + 筛选 */}
      <div className="mb-4 flex flex-col gap-3">
        <form action={`${basePath}/books`} method="get" role="search" className="flex items-center gap-2">
          {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
          {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
          {filters.sortBy !== 'updatedAt' ? <input type="hidden" name="sortBy" value={filters.sortBy} /> : null}
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              name="keyword"
              defaultValue={filters.keyword}
              placeholder="搜索书名 / 作者"
              className="h-6 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            搜索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            分类
          </span>
          <Link href={listHref({ category: '', page: 1 })} className={chipClass(!filters.category)}>
            全部
          </Link>
          <CategoryChips ctx={ctx} className="contents" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={listHref({ status: option.value, page: 1 })}
                className={chipClass(filters.status === option.value)}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <div className="flex flex-wrap items-center gap-2">
            {SORT_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={listHref({ sortBy: option.value, page: 1 })}
                className={chipClass(filters.sortBy === option.value)}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {data === null ? (
        <PortalLoadError basePath={basePath} compact />
      ) : (
        <>
          <theme.BookGrid ctx={ctx} novels={data.items} emptyText="没有找到符合条件的书籍" />
          <PaginationLinks
            page={filters.page}
            total={data.total}
            pageSize={data.pageSize || pageSize}
            basePath={basePath}
            pathname="/books"
            query={{
              keyword: filters.keyword || undefined,
              category: filters.category || undefined,
              status: filters.status || undefined,
              sortBy: filters.sortBy === 'updatedAt' ? undefined : filters.sortBy,
            }}
            className="mt-8 border-t border-border pt-4"
          />
        </>
      )}

      {ctx.categories.length ? (
        <div className="mt-10 border-t border-border pt-6">
          <p className="mb-3 text-xs font-medium text-muted-foreground">按分类浏览</p>
          <CategoryChips ctx={ctx} />
        </div>
      ) : null}
    </div>
  );
}
