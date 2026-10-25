import type { Metadata } from 'next';
import { MemberLoginForm } from '@/components/portal/member/member-login-form';
import { resolveMemberRouteSite } from '@/components/portal/member/page-context';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '会员登录',
  robots: { index: false, follow: false },
};

export default async function MemberLoginPage() {
  const site = await resolveMemberRouteSite();
  return <MemberLoginForm siteSlug={site.siteSlug} basePath={site.basePath} siteName={site.siteName} />;
}
