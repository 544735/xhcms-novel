import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-[88px] font-bold leading-none gradient-text">404</div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">页面不存在</h1>
        <p className="text-sm text-muted-foreground">
          你访问的内容可能已被删除或移动，请检查链接是否正确。
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          返回首页
        </Link>
        <Link
          href="/admin"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          管理后台
        </Link>
      </div>
    </div>
  );
}
