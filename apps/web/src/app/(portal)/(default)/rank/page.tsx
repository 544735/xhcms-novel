import type { Metadata } from 'next';
import { RankView, normalizeRankType } from '@/components/portal/server/views/rank-view';
import { getPortalContext } from '@/components/portal/server/context';
import { buildListMetadata } from '@/components/portal/server/metadata';

export const revalidate = 30;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { type } = await searchParams;
  const result = await getPortalContext('');
  if (result.status !== 'ok') return { title: '排行榜' };
  const rankType = normalizeRankType(type);
  const label =
    rankType === 'hot' ? '热门榜' : rankType === 'new' ? '新书榜' : rankType === 'favorite' ? '收藏榜' : '字数榜';
  return buildListMetadata(result.ctx, {
    title: `排行榜 · ${label}`,
    description: '小说热门榜、新书榜、收藏榜与字数榜',
    path: `/rank?type=${rankType}`,
  });
}

export default async function PortalRankPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return <RankView basePath="" type={normalizeRankType(type)} />;
}
