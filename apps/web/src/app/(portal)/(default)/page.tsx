import { HomeView } from '@/components/portal/server/views/home-view';

/** 默认站点首页（小说站）：Hero / 推荐 / 最新 / 完结 / 榜单 */
export const revalidate = 30;

export default function PortalHomePage() {
  return <HomeView basePath="" />;
}
