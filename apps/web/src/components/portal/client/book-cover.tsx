import { cn } from '@/lib/utils';

/** 书籍封面占位组件：无封面时用渐变 + 书名兜底 */
export function BookCover({
  src,
  title,
  className,
  aspect = 'aspect-[3/4]',
}: {
  src?: string | null;
  title: string;
  className?: string;
  aspect?: string;
}) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-lg border border-border bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-sky-500/20 shadow-sm',
        aspect,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <span className="line-clamp-3 text-xs font-medium leading-snug text-foreground/80">{title}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">XHCMS</span>
        </div>
      )}
    </div>
  );
}
