'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookX } from 'lucide-react';

/**
 * 门户 404（书籍 / 章节 / 分类 / 作者不存在，或未知站点 slug）。
 *
 * 必须是客户端组件：`[site]` 入口（如 /ink/book/不存在）下「返回首页」要回到 /ink，
 * 而服务端拿不到 pathname，只能用 usePathname 推导站点前缀，否则会把用户丢回
 * Host 解析出的默认站点、丢掉当前站点上下文。
 */

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

export default function PortalNotFound() {
  const pathname = usePathname() ?? '';
  const basePath = portalBasePathFromPathname(pathname);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <BookX className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <p className="text-4xl font-bold leading-none tracking-tight text-foreground/20">404</p>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">找不到这本书</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          你访问的书籍、章节可能已下架或链接有误。可以返回首页，或去书库找找其他好书。
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={basePath || '/'}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          返回首页
        </Link>
        <Link
          href={`${basePath}/books`}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          去书库
        </Link>
      </div>
    </div>
  );
}
