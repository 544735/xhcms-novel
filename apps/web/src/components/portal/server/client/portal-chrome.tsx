'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * 门户外壳的「阅读器例外」开关（客户端）。
 *
 * 阅读器 `/read/<novel>/<chapter>`（含 `/ink/read/...` 前缀入口）需要隐藏站点 Header / Footer
 * 以实现沉浸阅读。布局是逐层包裹的，无法在子布局里「撤销」父布局，因此这里用 usePathname 在
 * 外壳层判断：阅读器路径只渲染 children（阅读器自身是 fixed 全屏容器，即使路径判断在极端情况下
 * 延迟也覆盖在站点装饰之上，不会闪烁）。
 */
export function PortalChrome({
  header,
  footer,
  backToTop,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  backToTop: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  // 必须是 `/read/<novelSlug>/<chapterNo>`（可带站点前缀）才判定为阅读器，
  // 避免 `/category/read`、`/book/read` 这类 slug 恰好叫 read 的普通页面被误判而丢掉站点头尾。
  const isReader = /^\/(?:[^/]+\/)?read\/[^/]+\/[^/]+$/.test(pathname);

  if (isReader) {
    return <>{children}</>;
  }

  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
      {backToTop}
    </>
  );
}
