'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 生产环境可接入前端错误上报
    console.error('[XHCMS] 页面渲染错误：', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">页面出现了一点问题</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          可能是网络波动或服务暂时不可用。你可以重试，或返回首页继续浏览。
        </p>
        {error.digest ? (
          <p className="font-mono text-[11px] text-muted-foreground/70">错误标识：{error.digest}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        重新加载
      </button>
    </div>
  );
}
