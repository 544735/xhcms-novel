'use client';

import type { Media } from '@wmcms/shared';
import { Check, Copy, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatBytes, formatDateTime } from '@/lib/utils';
import { formatDimensions, isImageMime, resolveMediaUrl } from './media-utils';

export interface MediaGridProps {
  items: Media[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onPick?: (media: Media) => void;
  onCopy?: (media: Media) => void;
  onDelete?: (media: Media) => void;
}

/** 媒体卡片集合（父组件负责 grid 布局） */
export function MediaGrid({
  items,
  selectedIds,
  onToggleSelect,
  onPick,
  onCopy,
  onDelete,
}: MediaGridProps) {
  return (
    <>
      {items.map((media) => {
        const selected = selectedIds?.has(media.id) ?? false;
        return (
          <div
            key={media.id}
            className={cn(
              'group flex flex-col overflow-hidden rounded-xl border bg-card transition-colors',
              selected ? 'border-primary ring-1 ring-primary/30' : 'border-border',
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              {isImageMime(media.mimeType) ? (
                <img
                  src={resolveMediaUrl(media.url)}
                  alt={media.originalName}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <FileText className="h-7 w-7" />
                  <span className="text-[11px] uppercase">{media.mimeType.split('/')[1] ?? '文件'}</span>
                </div>
              )}

              {onToggleSelect ? (
                <button
                  type="button"
                  onClick={() => onToggleSelect(media.id)}
                  aria-pressed={selected}
                  aria-label={selected ? `取消选择 ${media.originalName}` : `选择 ${media.originalName}`}
                  className={cn(
                    'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-opacity',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground opacity-100'
                      : 'border-white/70 bg-slate-950/40 text-white opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
                  )}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              ) : null}

              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(media)}
                  className="absolute inset-0 flex items-end justify-center p-3 opacity-0 transition-all hover:bg-slate-950/40 hover:opacity-100 focus-visible:bg-slate-950/40 focus-visible:opacity-100"
                >
                  <span className="rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                    选择此文件
                  </span>
                </button>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <p className="truncate text-xs font-medium text-foreground" title={media.originalName}>
                {media.originalName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {formatBytes(media.size)} · {formatDimensions(media.width, media.height)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {formatDateTime(media.createdAt)}
              </p>
              {onCopy || onDelete ? (
                <div className="mt-auto flex flex-wrap items-center justify-end gap-1 pt-1">
                  {onCopy ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => onCopy(media)}
                    >
                      复制链接
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => onDelete(media)}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
