import type { Metadata } from 'next';
import { SearchView } from '@/components/portal/server/views/search-view';
import { buildNoindexMetadata } from '@/components/portal/server/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return buildNoindexMetadata(q ? `搜索：${q}` : '搜书');
}

export default async function PrefixSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [{ site }, sp] = await Promise.all([params, searchParams]);
  return (
    <SearchView
      basePath={`/${site}`}
      siteSlug={site}
      q={sp.q ?? ''}
      page={Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)}
    />
  );
}
