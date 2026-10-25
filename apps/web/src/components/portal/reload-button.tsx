'use client';

import { RotateCcw } from 'lucide-react';

/** 兜底页的「重新加载」按钮（需要浏览器刷新，故单独作为客户端组件） */
export function ReloadButton({
  label = '重新加载',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className={
        className ??
        'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted'
      }
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
