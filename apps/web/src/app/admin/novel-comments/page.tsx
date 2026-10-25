'use client';

import { COMMENT_STATUS_LABELS, type CommentStatus, type NovelComment } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, Trash2, TriangleAlert, X } from 'lucide-react';
import * as React from 'react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ApiError, novelCommentsApi, novelsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { errorText, readSearchParam } from '@/components/admin/novel/novel-utils';
import { cn, formatDateTime, truncate } from '@/lib/utils';

type CommentRow = NovelComment & {
  novel?: { id: string; title: string };
  chapter?: { id: string; title: string } | null;
};

const STATUS_BADGE: Record<CommentStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

type BatchAction = 'approve' | 'reject' | 'delete';

const BATCH_LABELS: Record<BatchAction, string> = {
  approve: '通过',
  reject: '拒绝',
  delete: '删除',
};

export default function NovelCommentsPage() {
  return (
    <PermissionGate permission="comment:view">
      <NovelCommentsContent />
    </PermissionGate>
  );
}

function NovelCommentsContent() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canUpdate = hasPermission('comment:update');
  const canDelete = hasPermission('comment:delete');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [statusFilter, setStatusFilter] = React.useState<CommentStatus | ''>(
    () => readSearchParam('status') as CommentStatus | '',
  );
  const [novelFilter, setNovelFilter] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<CommentRow | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, novelFilter]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter, novelFilter]);

  const commentsQuery = useQuery({
    queryKey: ['novel-comments', currentSiteId, page, pageSize, statusFilter, novelFilter],
    queryFn: () =>
      novelCommentsApi.list({
        page,
        pageSize,
        status: statusFilter || undefined,
        novelId: novelFilter || undefined,
      }),
  });

  const novelsQuery = useQuery({
    queryKey: ['novels', 'options', currentSiteId],
    queryFn: () => novelsApi.list({ page: 1, pageSize: 100, sortBy: 'updatedAt', order: 'desc' }),
  });

  const items = (commentsQuery.data?.items ?? []) as CommentRow[];
  const total = commentsQuery.data?.total ?? 0;
  const errorMessage =
    commentsQuery.error instanceof ApiError
      ? commentsQuery.error.message
      : commentsQuery.isError
        ? '评论加载失败，请稍后重试'
        : null;

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      novelCommentsApi.setStatus(id, status),
    onSuccess: async (_data, variables) => {
      toast.success(variables.status === 'approved' ? '评论已通过' : '评论已拒绝');
      await queryClient.invalidateQueries({ queryKey: ['novel-comments'] });
      await queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] });
    },
    onError: (error) => toast.error('操作失败', { description: errorText(error) }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => novelCommentsApi.remove(id),
    onSuccess: async () => {
      toast.success('评论已删除');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['novel-comments'] });
      await queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] });
    },
    onError: (error) => toast.error('删除失败', { description: errorText(error) }),
  });

  // 契约未提供评论批量接口，前端对选中项逐个调用后汇总结果
  const batchMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: BatchAction }) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          action === 'delete'
            ? novelCommentsApi.remove(id)
            : novelCommentsApi.setStatus(id, action === 'approve' ? 'approved' : 'rejected'),
        ),
      );
      return {
        succeeded: results.filter((result) => result.status === 'fulfilled').length,
        failed: results.filter((result) => result.status === 'rejected').length,
      };
    },
    onSuccess: async (result, variables) => {
      if (result.failed) {
        toast.warning(`已${BATCH_LABELS[variables.action]} ${result.succeeded} 条，失败 ${result.failed} 条`);
      } else {
        toast.success(`已${BATCH_LABELS[variables.action]} ${result.succeeded} 条评论`);
      }
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['novel-comments'] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
    },
    onError: (error) => {
      setBatchDeleteOpen(false);
      toast.error('批量操作失败', { description: errorText(error) });
    },
  });

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (items.length > 0 && items.every((item) => prev.has(item.id))) return new Set();
      return new Set(items.map((item) => item.id));
    });
  };

  const runBatch = (action: BatchAction) => {
    if (!selectedIds.size) return;
    batchMutation.mutate({ ids: Array.from(selectedIds), action });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="评论审核"
        description="审核门户的书评与章评；通过后才会在门户展示。"
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            onClick={() => void commentsQuery.refetch()}
          >
            刷新
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CommentStatus | '')}
            aria-label="评论状态筛选"
            className="w-full sm:w-32"
          >
            <option value="">全部状态</option>
            {(Object.keys(COMMENT_STATUS_LABELS) as CommentStatus[]).map((status) => (
              <option key={status} value={status}>
                {COMMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            value={novelFilter}
            onChange={(event) => setNovelFilter(event.target.value)}
            aria-label="按书籍筛选"
            className="w-full sm:w-52"
          >
            <option value="">全部书籍</option>
            {(novelsQuery.data?.items ?? []).map((novel) => (
              <option key={novel.id} value={novel.id}>
                {novel.title}
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted-foreground sm:ml-auto">共 {total} 条评论</span>
        </CardContent>
      </Card>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">已选择 {selectedIds.size} 条</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canUpdate ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Check className="h-3.5 w-3.5" />}
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('approve')}
                >
                  批量通过
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<X className="h-3.5 w-3.5" />}
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('reject')}
                >
                  批量拒绝
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button
                size="sm"
                variant="destructive"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                disabled={batchMutation.isPending}
                onClick={() => setBatchDeleteOpen(true)}
              >
                批量删除
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              取消选择
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {commentsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : errorMessage ? (
          <EmptyState
            icon={TriangleAlert}
            title="评论加载失败"
            description={errorMessage}
            action={
              <Button variant="outline" size="sm" onClick={() => void commentsQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : !items.length ? (
          <EmptyState
            icon={MessageSquare}
            title={statusFilter ? '该状态下暂无评论' : '暂无评论'}
            description="门户读者发表书评或章评后，会在这里等待审核。"
          />
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="全选评论"
                    className="h-4 w-4 cursor-pointer rounded border-input accent-indigo-600"
                  />
                </TableHead>
                <TableHead className="min-w-[260px]">内容</TableHead>
                <TableHead className="w-24">类型</TableHead>
                <TableHead className="min-w-[180px]">所属</TableHead>
                <TableHead className="w-28">读者</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-36">时间</TableHead>
                <TableHead className="w-16 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((comment) => {
                const selected = selectedIds.has(comment.id);
                const actions: RowActionItem[] = [];
                if (canUpdate) {
                  actions.push({
                    label: '通过',
                    icon: <Check className="h-3.5 w-3.5" />,
                    disabled: comment.status === 'approved',
                    onSelect: () => setStatusMutation.mutate({ id: comment.id, status: 'approved' }),
                  });
                  actions.push({
                    label: '拒绝',
                    icon: <X className="h-3.5 w-3.5" />,
                    disabled: comment.status === 'rejected',
                    onSelect: () => setStatusMutation.mutate({ id: comment.id, status: 'rejected' }),
                  });
                }
                if (canDelete) {
                  actions.push({
                    label: '删除',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    danger: true,
                    separatorBefore: true,
                    onSelect: () => setDeleteTarget(comment),
                  });
                }
                return (
                  <TableRow key={comment.id} className={cn(selected && 'bg-primary/5')}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(comment.id)}
                        aria-label="选择评论"
                        className="h-4 w-4 cursor-pointer rounded border-input accent-indigo-600"
                      />
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-2 max-w-[340px] text-sm leading-relaxed text-foreground/90">
                        {truncate(comment.content, 120)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={comment.chapterId ? 'info' : 'secondary'}>
                        {comment.chapterId ? '章评' : '书评'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-1 text-xs text-foreground/80">
                        {comment.novel?.title ?? '—'}
                      </p>
                      {comment.chapter ? (
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {comment.chapter.title}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{comment.nickname}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[comment.status]} dot>
                        {COMMENT_STATUS_LABELS[comment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {actions.length ? (
                        <RowActions items={actions} label="评论操作" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!commentsQuery.isLoading && !errorMessage && total > 0 ? (
          <div className="border-t border-border/70 px-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除评论"
        description={deleteTarget ? `确定删除 ${deleteTarget.nickname} 的这条评论吗？` : undefined}
        confirmText="删除"
        loading={removeMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await removeMutation.mutateAsync(deleteTarget.id);
          } catch {
            /* onError 已提示 */
          }
        }}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="批量删除评论"
        description={`确定删除已选中的 ${selectedIds.size} 条评论吗？该操作不可撤销。`}
        confirmText="全部删除"
        loading={batchMutation.isPending}
        onConfirm={async () => {
          try {
            await batchMutation.mutateAsync({ ids: Array.from(selectedIds), action: 'delete' });
          } catch {
            /* onError 已提示 */
          }
        }}
      />
    </div>
  );
}
