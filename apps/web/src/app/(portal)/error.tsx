'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** 门户一级路由段（与 app/(portal)/ 下的真实目录一致）；首段命中它们说明是默认入口 */
const PORTAL_ROUTE_SEGMENTS = new Set([
  'read',
  'book',
  'books',
  'category',
  'rank',
  'search',
  'shelf',
  'history',
  'vip',
  'member',
  'author',
  'author-center',
]);

/** 由当前路径推导站点前缀：'/ink/book/x' → '/ink'，'/book/x' → ''（默认入口） */
function portalBasePathFromPathname(pathname: string): string {
  const [first, second] = pathname.split('/').filter(Boolean);
  if (!first || PORTAL_ROUTE_SEGMENTS.has(first)) return '';
  if (!second || PORTAL_ROUTE_SEGMENTS.has(second)) return `/${first}`;
  return '';
}

/**
 * 门户错误边界：渲染异常 / 数据异常时兜底，避免白屏。
 * 「返回首页」保留站点前缀（与 not-found.tsx 同一套推导，避免 /ink 下跳回默认站点）。
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? '';
  const basePath = portalBasePathFromPathname(pathname);

  useEffect(() => {
    console.error('[XHCMS][portal] 页面渲染错误：', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">内容加载失败，请稍后重试</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          页面渲染时遇到问题，可能是书城服务暂时不可用。你可以重试，或返回首页继续找书。
        </p>
        {error.digest ? (
          <p className="font-mono text-[11px] text-muted-foreground/70">错误标识：{error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重试
        </button>
        <Link
          href={basePath || '/'}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
