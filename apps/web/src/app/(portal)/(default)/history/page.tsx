import type { Metadata } from 'next';
import { ShelfView } from '@/components/portal/member/shelf-view';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '阅读历史',
  robots: { index: false, follow: false },
};

export default async function HistoryPage() {
  const site = await resolveMemberRouteSite();
  return <ShelfView siteSlug={site.siteSlug} basePath={site.basePath} initialTab="history" />;
}
