import type { Metadata } from 'next';
import { MemberLoginForm } from '@/components/portal/member/member-login-form';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '会员登录',
  robots: { index: false, follow: false },
};

export default async function SiteMemberLoginPage({ params }: { params: Promise<{ site: string }> }) {
  const { site: siteParam } = await params;
  const site = await resolveMemberRouteSite(siteParam);
  return <MemberLoginForm siteSlug={site.siteSlug} basePath={site.basePath} siteName={site.siteName} />;
}
