/**
 * 门户路由组根布局（纯透传层）。
 *
 * 主题外壳按入口分成两个分组：
 * - `(portal)/(default)/layout.tsx` → Host 解析站点，`/`、`/article/...`
 * - `(portal)/[site]/layout.tsx`    → 前缀强制站点，`/life`、`/life/article/...`
 *
 * 两个布局都调用 `components/portal/server/portal-shell.tsx`（按 site.themeKey 选择主题、
 * 注入品牌色 CSS 变量）。这里保持透传，避免在前缀入口下出现双层 Header/Footer。
 */
export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
