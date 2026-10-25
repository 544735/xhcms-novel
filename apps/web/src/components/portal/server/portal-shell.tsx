import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { buildThemeCssVars } from '@/lib/site';
import { getTheme } from '@/themes';
import { getPortalContext } from './context';
import { PortalLoadError } from './load-error';
import { BackToTop } from './client/back-to-top';
import { PortalChrome } from './client/portal-chrome';

/**
 * 小说门户主题外壳（server component）。
 *
 * 两种入口（默认 Host 解析 / `[site]` 前缀）共用这套外壳：
 * 1. 解析站点上下文（getPortalContext，请求级缓存）；
 * 2. 按 `site.themeKey` 选择主题（modern 星海夜读 / magazine 墨香书卷 / minimal 极简纯读）渲染 Header / Footer；
 * 3. 把 `site.settings.primaryColor` 转成 CSS 变量注入（含深色模式一套），品牌色覆盖全局语义色。
 * 4. 阅读器路径（/read/**）由 PortalChrome 判定后不渲染 Header/Footer，实现沉浸阅读。
 *
 * 注：App Router 布局逐层包裹，若在 (portal)/layout.tsx 直接渲染外壳，`[site]` 前缀入口会出现双层
 * Header；因此两个入口各自的 layout 调用本组件，主题选择逻辑集中在这里。
 */
export async function PortalShell({
  basePath,
  siteSlug,
  children,
}: {
  basePath: string;
  siteSlug?: string;
  children: ReactNode;
}) {
  const result = await getPortalContext(basePath, siteSlug);

  if (result.status === 'not-found') notFound();
  if (result.status === 'error') {
    return (
      <div className="portal-theme flex min-h-screen flex-col bg-background">
        <PortalLoadError basePath={basePath} />
      </div>
    );
  }

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);
  const themeCss = buildThemeCssVars(ctx.settings.primaryColor);

  return (
    <div className={`portal-theme portal-theme-${theme.key} flex min-h-screen flex-col bg-background`}>
      {/* 品牌色 CSS 变量（随站点 settings.primaryColor 变化，含 .dark 覆盖） */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <PortalChrome
        header={<theme.Header ctx={ctx} />}
        footer={<theme.Footer ctx={ctx} />}
        backToTop={<BackToTop />}
      >
        {children}
      </PortalChrome>
    </div>
  );
}
