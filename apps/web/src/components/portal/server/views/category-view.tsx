import Link from 'next/link';
import { notFound } from 'next/navigation';
import { novelPortalApi } from '@/lib/server-api';
import { getTheme } from '@/themes';
import { CategoryChips, PaginationLinks, SiteBreadcrumb } from '@/themes/shared';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';
import { findCategoryBySlug, findCategoryPath } from '../utils';

/** 分类页 /category/[slug]：分类头 + 子分类 + 分页书籍列表 */
export async function CategoryView({
  basePath,
  siteSlug,
  slug,
  page,
}: {
  basePath: string;
  siteSlug?: string;
  slug: string;
  page: number;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);

  if (!ctx.categoriesAvailable) {
    return (
      <div className="container py-12">
        <PortalLoadError basePath={basePath} compact />
      </div>
    );
  }

  const category = findCategoryBySlug(ctx.categories, slug);
  if (!category) notFound();

  const path = findCategoryPath(ctx.categories, slug);
  const pageSize = ctx.settings.pageSize;
  const data = await novelPortalApi.novels(ctx.site.slug, {
    categorySlug: category.slug,
    page,
    pageSize,
    sortBy: 'updatedAt',
    order: 'desc',
  });

  return (
    <div className="container py-8">
      <SiteBreadcrumb
        items={[
          { label: '首页', href: basePath || '/' },
          { label: '书库', href: `${basePath}/books` },
          ...path.map((node, index) =>
            index === path.length - 1
              ? { label: node.name }
              : { label: node.name, href: `${basePath}/category/${node.slug}` },
          ),
        ]}
      />

      <header className="mb-8 space-y-3 border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">分类</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {category.name}
        </h1>
        <p className="text-xs text-muted-foreground">
          共 {data?.total ?? 0} 本小说 · 按最近更新排序
        </p>
        {category.children?.length ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`${basePath}/category/${child.slug}`}
                className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:text-primary"
              >
                {child.name}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {data === null ? (
        <PortalLoadError basePath={basePath} compact />
      ) : (
        <>
          <theme.BookGrid ctx={ctx} novels={data.items} emptyText="该分类下暂无书籍" />
          <PaginationLinks
            page={page}
            total={data.total}
            pageSize={data.pageSize || pageSize}
            basePath={basePath}
            pathname={`/category/${category.slug}`}
            className="mt-10 border-t border-border pt-4"
          />
        </>
      )}

      <div className="mt-10 border-t border-border pt-6">
        <p className="mb-3 text-xs font-medium text-muted-foreground">其他分类</p>
        <CategoryChips ctx={ctx} categories={ctx.categories.filter((item) => item.slug !== slug)} />
      </div>
    </div>
  );
}
