import { HomeView } from '@/components/portal/server/views/home-view';

/** 前缀站点首页（/ink 等）：小说站 */
export const revalidate = 30;

export default async function PrefixHomePage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  return <HomeView basePath={`/${site}`} siteSlug={site} />;
}
