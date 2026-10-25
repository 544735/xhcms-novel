import type { Metadata } from 'next';
import { VipView } from '@/components/portal/member/vip-view';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '充值 VIP',
  robots: { index: false, follow: false },
};

export default async function VipPage() {
  const site = await resolveMemberRouteSite();
  return <VipView siteSlug={site.siteSlug} basePath={site.basePath} />;
}
