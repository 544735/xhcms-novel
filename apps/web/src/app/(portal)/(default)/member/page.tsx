import type { Metadata } from 'next';
import { MemberCenterView } from '@/components/portal/member/member-center-view';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '会员中心',
  robots: { index: false, follow: false },
};

export default async function MemberPage() {
  const site = await resolveMemberRouteSite();
  return <MemberCenterView siteSlug={site.siteSlug} basePath={site.basePath} siteName={site.siteName} />;
}
