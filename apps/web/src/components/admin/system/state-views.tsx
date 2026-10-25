'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/** 查询失败占位：统一提供重试入口 */
export function QueryErrorState({
  title = '加载失败',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={className ?? 'rounded-xl border border-border bg-card'}>
      <EmptyState
        icon={AlertTriangle}
        title={title}
        description={description ?? '请检查网络连接，或稍后重试。'}
        action={
          onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
