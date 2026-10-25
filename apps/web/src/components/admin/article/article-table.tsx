'use client';

import type { ArticleListItem } from '@wmcms/shared';
import {
  Eye,
  FileText,
  ImageIcon,
  Pencil,
  Pin,
  Plus,
  Send,
  Star,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { resolveMediaUrl } from '@/components/admin/media/media-utils';
import { ArticleStatusBadge } from './article-status-badge';
import { RowActions, type RowActionItem } from './row-actions';

export interface ArticleTableProps {
  items: ArticleListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  canUpdate: boolean;
  canPublish: boolean;
  canDelete: boolean;
  busyId: string | null;
  onToggleFlag: (article: ArticleListItem, flag: 'isTop' | 'isRecommend') => void;
  onEdit: (article: ArticleListItem) => void;
  onPreview: (article: ArticleListItem) => void;
  onTogglePublish: (article: ArticleListItem) => void;
  onDelete: (article: ArticleListItem) => void;
  onCreate: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

export function ArticleTable({
  items,
  isLoading,
  errorMessage,
  onRetry,
  selectedIds,
  allSelected,
  onToggleSelect,
  onToggleSelectAll,
  canUpdate,
  canPublish,
  canDelete,
  busyId,
  onToggleFlag,
  onEdit,
  onPreview,
  onTogglePublish,
  onDelete,
  onCreate,
  onClearFilters,
  hasFilters,
}: ArticleTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={6} cols={8} />;
  }

  if (errorMessage) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="文章列表加载失败"
        description={errorMessage}
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            重新加载
          </Button>
        }
      />
    );
  }

  if (!items.length) {
    return hasFilters ? (
      <EmptyState
        icon={FileText}
        title="没有符合条件的文章"
        description="尝试更换关键词或筛选条件，或清空筛选查看全部文章。"
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            清空筛选
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={FileText}
        title="暂无文章"
        description="创建第一篇文章，开始内容创作。"
        action={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
            新建文章
          </Button>
        }
      />
    );
  }

  return (
    <Table className="min-w-[900px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              aria-label="全选当前页文章"
              className="h-4 w-4 cursor-pointer rounded border-input accent-indigo-600"
            />
          </TableHead>
          <TableHead className="min-w-[260px]">标题</TableHead>
          <TableHead className="w-28">栏目</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="w-20">标记</TableHead>
          <TableHead className="w-24">作者</TableHead>
          <TableHead className="w-20">浏览</TableHead>
          <TableHead className="w-36">发布时间</TableHead>
          <TableHead className="w-16 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const selected = selectedIds.has(item.id);
          const busy = busyId === item.id;
          const actions: RowActionItem[] = [
            {
              label: '编辑',
              icon: <Pencil className="h-3.5 w-3.5" />,
              disabled: !canUpdate,
              onSelect: () => onEdit(item),
            },
            {
              label: '预览',
              icon: <Eye className="h-3.5 w-3.5" />,
              onSelect: () => onPreview(item),
            },
          ];
          if (canPublish) {
            actions.push({
              label: item.status === 'published' ? '撤回发布' : '发布',
              icon:
                item.status === 'published' ? (
                  <Undo2 className="h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                ),
              separatorBefore: true,
              onSelect: () => onTogglePublish(item),
            });
          }
          if (canDelete) {
            actions.push({
              label: '删除',
              icon: <Trash2 className="h-3.5 w-3.5" />,
              danger: true,
              separatorBefore: true,
              onSelect: () => onDelete(item),
            });
          }

          return (
            <TableRow key={item.id} className={cn(selected && 'bg-primary/5')}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect(item.id)}
                  aria-label={`选择文章 ${item.title}`}
                  className="h-4 w-4 cursor-pointer rounded border-input accent-indigo-600"
                />
              </TableCell>

              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  {item.cover ? (
                    <img
                      src={resolveMediaUrl(item.cover)}
                      alt=""
                      loading="lazy"
                      className="h-10 w-14 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => (canUpdate ? onEdit(item) : onPreview(item))}
                      title={item.title}
                      className="block max-w-[220px] truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary sm:max-w-[320px]"
                    >
                      {item.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {item.isTop ? (
                        <Badge variant="warning" dot>
                          置顶
                        </Badge>
                      ) : null}
                      {item.isRecommend ? <Badge variant="purple">推荐</Badge> : null}
                      <span className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                        {item.slug}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {item.category?.name ?? '未分类'}
                </span>
              </TableCell>

              <TableCell>
                <ArticleStatusBadge status={item.status} />
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!canUpdate || busy}
                    aria-label={item.isTop ? '取消置顶' : '设为置顶'}
                    title={item.isTop ? '取消置顶' : '设为置顶'}
                    onClick={() => onToggleFlag(item, 'isTop')}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
                      item.isTop && 'bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning',
                    )}
                  >
                    <Pin className={cn('h-4 w-4', item.isTop && 'fill-current')} />
                  </button>
                  <button
                    type="button"
                    disabled={!canUpdate || busy}
                    aria-label={item.isRecommend ? '取消推荐' : '设为推荐'}
                    title={item.isRecommend ? '取消推荐' : '设为推荐'}
                    onClick={() => onToggleFlag(item, 'isRecommend')}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
                      item.isRecommend &&
                        'bg-violet-500/10 text-violet-600 hover:bg-violet-500/15 hover:text-violet-600 dark:text-violet-400',
                    )}
                  >
                    <Star className={cn('h-4 w-4', item.isRecommend && 'fill-current')} />
                  </button>
                </div>
              </TableCell>

              <TableCell>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {item.authorName ?? '—'}
                </span>
              </TableCell>

              <TableCell>
                <span className="text-xs text-muted-foreground">{formatNumber(item.views)}</span>
              </TableCell>

              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(item.publishedAt ?? item.createdAt)}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <RowActions items={actions} label="文章操作" disabled={busy} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
