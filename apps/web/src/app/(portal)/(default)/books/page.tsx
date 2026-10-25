import type { Metadata } from 'next';
import {
  BooksView,
  type BookSort,
  type BookStatus,
} from '@/components/portal/server/views/books-view';
import { getPortalContext } from '@/components/portal/server/context';
import { buildListMetadata } from '@/components/portal/server/metadata';

export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPortalContext('');
  if (result.status !== 'ok') return { title: '书库' };
  return buildListMetadata(result.ctx, {
    title: '书库',
    description: '全部小说，支持分类、连载状态与排序筛选',
    path: '/books',
  });
}

const SORT_VALUES: BookSort[] = ['updatedAt', 'views', 'favorites', 'words', 'createdAt'];

function parseSort(value: string | undefined): BookSort {
  return SORT_VALUES.includes(value as BookSort) ? (value as BookSort) : 'updatedAt';
}

function parseStatus(value: string | undefined): BookStatus {
  return value === 'serial' || value === 'completed' ? value : '';
}

export default async function PortalBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; keyword?: string; category?: string; status?: string; sortBy?: string }>;
}) {
  const sp = await searchParams;
  return (
    <BooksView
      basePath=""
      filters={{
        page: Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1),
        keyword: sp.keyword?.trim() ?? '',
        category: sp.category?.trim() ?? '',
        status: parseStatus(sp.status),
        sortBy: parseSort(sp.sortBy),
      }}
    />
  );
}
