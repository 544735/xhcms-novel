'use client';

import type { Article } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { resolveMediaUrl } from '@/components/admin/media/media-utils';
import { ArticleStatusBadge } from './article-status-badge';

export interface ArticlePreviewDialogProps {
  articleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fallbackTitle?: string;
}

/** 文章预览弹窗：直接读取管理端详情接口，渲染已保存的正文 */
export function ArticlePreviewDialog({
  articleId,
  open,
  onOpenChange,
  fallbackTitle,
}: ArticlePreviewDialogProps) {
  const { data, isLoading, isError, error, refetch } = useQuery<Article>({
    queryKey: ['article-preview', articleId],
    queryFn: () => api.articles.get(articleId as string),
    enabled: open && Boolean(articleId),
    staleTime: 0,
  });

  const errorMessage = error instanceof ApiError ? error.message : '加载文章失败，请稍后重试';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="文章预览"
      description={fallbackTitle}
      size="xl"
      footer={
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          关闭
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <SkeletonText lines={8} />
        </div>
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="加载失败"
          description={errorMessage}
          action={
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              重试
            </Button>
          }
        />
      ) : data ? (
        <article className="space-y-4">
          <header className="space-y-2.5">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{data.title}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <ArticleStatusBadge status={data.status} />
              <span>栏目：{data.category?.name ?? '未分类'}</span>
              <span aria-hidden>·</span>
              <span>作者：{data.authorName ?? '未知'}</span>
              <span aria-hidden>·</span>
              <span>{formatDateTime(data.publishedAt ?? data.createdAt)}</span>
              <span aria-hidden>·</span>
              <span>{data.views} 次浏览</span>
            </div>
            {data.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : null}
            {data.summary ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                摘要：{data.summary}
              </p>
            ) : null}
          </header>

          {data.cover ? (
            <img
              src={resolveMediaUrl(data.cover)}
              alt={data.title}
              className="max-h-72 w-full rounded-xl border border-border object-cover"
            />
          ) : null}

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            {data.content ? (
              // 正文在写入时已由后端按 API_CONTRACT §1 的 sanitize-html 白名单清洗（与门户渲染链路一致）
              <div className="prose-wmcms" dangerouslySetInnerHTML={{ __html: data.content }} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">该文章暂无正文内容</p>
            )}
          </div>
        </article>
      ) : null}
    </Dialog>
  );
}
