import type { Metadata } from 'next';
import { ShelfView } from '@/components/portal/member/shelf-view';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '我的书架',
  robots: { index: false, follow: false },
};

export default async function ShelfPage() {
  const site = await resolveMemberRouteSite();
  return <ShelfView siteSlug={site.siteSlug} basePath={site.basePath} initialTab="shelf" />;
}
