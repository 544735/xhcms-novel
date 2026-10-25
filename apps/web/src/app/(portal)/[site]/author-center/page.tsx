import type { Metadata } from 'next';
import { AuthorCenterView } from '@/components/portal/author/author-center-view';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '作者中心',
  robots: { index: false, follow: false },
};

export default async function SiteAuthorCenterPage({ params }: { params: Promise<{ site: string }> }) {
  const { site: siteParam } = await params;
  const site = await resolveMemberRouteSite(siteParam);
  return <AuthorCenterView siteSlug={site.siteSlug} basePath={site.basePath} />;
}
