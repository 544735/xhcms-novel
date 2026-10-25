import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryView } from '@/components/portal/server/views/category-view';
import { getPortalContext } from '@/components/portal/server/context';
import { buildListMetadata } from '@/components/portal/server/metadata';
import { findCategoryBySlug } from '@/components/portal/server/utils';

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPortalContext('');
  if (result.status !== 'ok') return { title: '分类' };
  const { ctx } = result;
  const category = findCategoryBySlug(ctx.categories, slug);
  if (ctx.categoriesAvailable && !category) notFound();
  return buildListMetadata(ctx, {
    title: category?.name ?? '分类',
    description: category ? `${ctx.site.name} · ${category.name}分类小说列表` : undefined,
    path: `/category/${slug}`,
  });
}

export default async function PortalCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return (
    <CategoryView
      basePath=""
      slug={slug}
      page={Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)}
    />
  );
}
