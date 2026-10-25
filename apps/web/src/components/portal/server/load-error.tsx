import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { ReloadButton } from '@/components/portal/reload-button';

/**
 * 门户兜底：站点 / 内容 API 不可用时展示，避免白屏。
 * 与 404（内容不存在）严格区分：这里是「服务暂时不可用」。
 */
export function PortalLoadError({
  basePath = '',
  title = '内容加载失败，请稍后重试',
  description = '可能是内容服务暂时不可用。稍后刷新页面，或先返回首页看看其他内容。',
  compact = false,
}: {
  basePath?: string;
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-center">
          <ReloadButton label="重试" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ReloadButton />
        <Link
          href={basePath || '/'}
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
