import Link from 'next/link';
import { BookX } from 'lucide-react';

/** 门户 404（书籍 / 章节 / 分类 / 作者不存在，或未知站点 slug） */
export default function PortalNotFound() {
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
          href="/"
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          返回首页
        </Link>
        <Link
          href="/books"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          去书库
        </Link>
      </div>
    </div>
  );
}
