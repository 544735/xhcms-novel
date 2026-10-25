'use client';

import type { NovelCard } from '@wmcms/shared';
import { BookOpen, Layers, Pencil, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { resolveMediaUrl } from '@/components/admin/media/media-utils';
import { NovelAuditBadge, NovelStatusBadge } from './novel-badges';

export interface NovelTableProps {
  items: NovelCard[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  canUpdate: boolean;
  canDelete: boolean;
  canReview: boolean;
  canViewChapters: boolean;
  busyId: string | null;
  onEdit: (novel: NovelCard) => void;
  onManageChapters: (novel: NovelCard) => void;
  onReview: (novel: NovelCard) => void;
  onToggleRecommend: (novel: NovelCard) => void;
  onDelete: (novel: NovelCard) => void;
  onCreate: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}

/** 书籍管理列表 */
export function NovelTable({
  items,
  isLoading,
  errorMessage,
  onRetry,
  selectedIds,
  allSelected,
  onToggleSelect,
  onToggleSelectAll,
  canUpdate,
  canDelete,
  canReview,
  canViewChapters,
  busyId,
  onEdit,
  onManageChapters,
  onReview,
  onToggleRecommend,
  onDelete,
  onCreate,
  onClearFilters,
  hasFilters,
}: NovelTableProps) {
  if (isLoading) return <TableSkeleton rows={6} cols={8} />;

  if (errorMessage) {
    return (
      <EmptyState
        icon={BookOpen}
        title="书籍列表加载失败"
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
        icon={BookOpen}
        title="没有符合条件的书籍"
        description="尝试更换关键词或筛选条件，或清空筛选查看全部书籍。"
        action={
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            清空筛选
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={BookOpen}
        title="暂无书籍"
        description="创建第一本书，或通过采集中心导入作品。"
        action={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
            新建书籍
          </Button>
        }
      />
    );
  }

  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              aria-label="全选当前页书籍"
              className="h-4 w-4 cursor-pointer rounded border-input accent-indigo-600"
            />
          </TableHead>
          <TableHead className="min-w-[260px]">书籍</TableHead>
          <TableHead className="w-28">作者</TableHead>
          <TableHead className="w-24">分类</TableHead>
          <TableHead className="w-24">连载</TableHead>
          <TableHead className="w-24">审核</TableHead>
          <TableHead className="w-28">字数/章节</TableHead>
          <TableHead className="w-28">人气</TableHead>
          <TableHead className="w-36">更新时间</TableHead>
          <TableHead className="w-16 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((novel) => {
          const selected = selectedIds.has(novel.id);
          const busy = busyId === novel.id;
          const actions: RowActionItem[] = [
            {
              label: '编辑',
              icon: <Pencil className="h-3.5 w-3.5" />,
              disabled: !canUpdate,
              onSelect: () => onEdit(novel),
            },
          ];
          if (canViewChapters) {
            actions.push({
              label: '分卷与章节',
              icon: <Layers className="h-3.5 w-3.5" />,
              onSelect: () => onManageChapters(novel),
            });
          }
          if (canReview) {
            actions.push({
              label: '审核',
              icon: <ShieldCheck className="h-3.5 w-3.5" />,
              separatorBefore: true,
              onSelect: () => onReview(novel),
            });
          }
          if (canUpdate) {
            actions.push({
              label: novel.isRecommend ? '取消推荐' : '设为推荐',
              icon: <Star className="h-3.5 w-3.5" />,
              onSelect: () => onToggleRecommend(novel),
            });
          }
          if (canDelete) {
            actions.push({
              label: '删除',
              icon: <Trash2 className="h-3.5 w-3.5" />,
              danger: true,
              separatorBefore: true,
              onSelect: () => onDelete(novel),
            });
          }

          return (
            <TableRow key={novel.id} className={cn(selected && 'bg-primary/5')}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelect(novel.id)}
                  aria-label={`选择书籍 ${novel.title}`}
                  className="h-4 w-4 cursor-pointer rounded border-input accent-indigo-600"
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  {novel.cover ? (
                    <img
                      src={resolveMediaUrl(novel.cover)}
                      alt=""
                      loading="lazy"
                      className="h-14 w-10 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => (canUpdate ? onEdit(novel) : onReview(novel))}
                      title={novel.title}
                      className="block max-w-[220px] truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary sm:max-w-[300px]"
                    >
                      {novel.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {novel.isRecommend ? <Badge variant="purple">推荐</Badge> : null}
                      {novel.isTop ? <Badge variant="warning">置顶</Badge> : null}
                      {novel.vipOnly ? <Badge variant="default">全书 VIP</Badge> : null}
                      <span className="max-w-[150px] truncate text-[11px] text-muted-foreground">
                        {novel.slug}
                      </span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="line-clamp-1 text-xs text-muted-foreground">{novel.authorName}</span>
              </TableCell>
              <TableCell>
                <span className="line-clamp-1 text-xs text-muted-foreground">
                  {novel.category?.name ?? '未分类'}
                </span>
              </TableCell>
              <TableCell>
                <NovelStatusBadge status={novel.status} />
              </TableCell>
              <TableCell>
                <NovelAuditBadge status={novel.auditStatus} />
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(novel.words)} 字 / {novel.chapterCount} 章
                </span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(novel.views)} 阅 · {formatNumber(novel.favorites)} 藏
                </span>
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">{formatDateTime(novel.updatedAt)}</span>
              </TableCell>
              <TableCell className="text-right">
                <RowActions items={actions} label="书籍操作" disabled={busy} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
