import type { Metadata } from 'next';
import { PortalShell } from '@/components/portal/server/portal-shell';
import { getPortalContext } from '@/components/portal/server/context';
import { buildSiteMetadata } from '@/components/portal/server/metadata';

/**
 * 默认站点入口（无前缀）：`/`、`/book/xxx`、`/read/xxx/1`、`/member`、`/shelf` …
 * 站点由请求 Host 解析（见 lib/site.ts 顶部「路由方案」说明）；主题外壳由 PortalShell 渲染，
 * 阅读器路径由 PortalChrome 自动隐藏 Header/Footer。
 */
export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPortalContext('');
  if (result.status !== 'ok') {
    return { title: '内容加载失败，请稍后重试', robots: { index: false, follow: false } };
  }
  return buildSiteMetadata(result.ctx);
}

export default function DefaultPortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell basePath="">{children}</PortalShell>;
}
