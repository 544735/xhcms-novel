'use client';

import type { Comment, CommentStatus } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, RefreshCw, Trash2, X } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime, truncate } from '@/lib/utils';

type CommentTab = 'pending' | 'approved' | 'rejected' | 'all';
type BatchAction = 'approve' | 'reject' | 'delete';

const TAB_OPTIONS: { value: CommentTab; label: string }[] = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'all', label: '全部' },
];

const BATCH_META: Record<BatchAction, { title: string; confirmText: string; destructive: boolean }> = {
  approve: { title: '批量通过评论', confirmText: '通过', destructive: false },
  reject: { title: '批量拒绝评论', confirmText: '拒绝', destructive: false },
  delete: { title: '批量删除评论', confirmText: '删除', destructive: true },
};

function CommentsContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [tab, setTab] = React.useState<CommentTab>('pending');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<Comment | null>(null);
  const [batchAction, setBatchAction] = React.useState<BatchAction | null>(null);

  React.useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab]);

  const commentsQuery = useQuery({
    queryKey: ['comments', 'list', page, pageSize, tab],
    queryFn: () =>
      api.comments.list({
        page,
        pageSize,
        status: tab === 'all' ? undefined : (tab as CommentStatus),
      }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['comments'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api.comments.setStatus(id, status),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === 'approved' ? '评论已通过' : '评论已拒绝');
      invalidate();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '评论审核失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.comments.remove(id),
    onSuccess: () => {
      toast.success('评论已删除');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BatchAction }) =>
      api.comments.batch(ids, action),
    onSuccess: (result) => {
      toast.success(`已处理 ${result.affected} 条评论`);
      invalidate();
      setSelected(new Set());
      setBatchAction(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '批量操作失败');
    },
  });

  const items = commentsQuery.data?.items ?? [];
  const pageIds = items.map((comment) => comment.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="评论审核"
        description="处理门户提交的评论：通过后展示在前台，拒绝或删除后不再可见。"
        actions={
          <Button variant="outline" onClick={() => void commentsQuery.refetch()} disabled={commentsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>评论审核台</CardTitle>
            <CardDescription className="mt-1">
              当前筛选共 {commentsQuery.data?.total ?? 0} 条评论
            </CardDescription>
          </div>
          <Tabs value={tab} onValueChange={(value) => setTab(value as CommentTab)}>
            <TabsList>
              {TAB_OPTIONS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>

        {selected.size > 0 ? (
          <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-xs font-medium text-foreground">已选择 {selected.size} 条</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {hasPermission('comment:update') ? (
                <>
                  <Button size="sm" variant="success" onClick={() => setBatchAction('approve')}>
                    <Check className="h-3.5 w-3.5" />
                    批量通过
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBatchAction('reject')}>
                    <X className="h-3.5 w-3.5" />
                    批量拒绝
                  </Button>
                </>
              ) : null}
              {hasPermission('comment:delete') ? (
                <Button size="sm" variant="destructive" onClick={() => setBatchAction('delete')}>
                  <Trash2 className="h-3.5 w-3.5" />
                  批量删除
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                清空选择
              </Button>
            </div>
          </div>
        ) : null}

        {commentsQuery.isLoading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : commentsQuery.isError ? (
          <CardContent>
            <QueryErrorState
              title="评论列表加载失败"
              description={
                commentsQuery.error instanceof ApiError ? commentsQuery.error.message : '无法获取评论数据，请稍后重试。'
              }
              onRetry={() => void commentsQuery.refetch()}
            />
          </CardContent>
        ) : !items.length ? (
          <CardContent>
            <EmptyState
              icon={MessageSquare}
              title={
                tab === 'pending'
                  ? '没有待审核评论'
                  : tab === 'approved'
                    ? '还没有通过的评论'
                    : tab === 'rejected'
                      ? '没有被拒绝的评论'
                      : '暂无评论'
              }
              description={
                tab === 'pending'
                  ? '审核队列已清空，新的评论提交后会出现在这里。'
                  : '切换上方状态标签可查看其他评论。'
              }
            />
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={allOnPageSelected}
                      onChange={togglePage}
                      aria-label="全选当前页"
                    />
                  </TableHead>
                  <TableHead>昵称</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>所属文章</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selected.has(comment.id)}
                        onChange={() => toggleOne(comment.id)}
                        aria-label={`选择 ${comment.nickname} 的评论`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{comment.nickname}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{comment.email || '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-xs text-xs leading-relaxed text-foreground/85" title={comment.content}>
                        {truncate(comment.content, 90)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-40 truncate text-xs text-muted-foreground">
                        {comment.article?.title ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {comment.ip ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={comment.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('comment:update') && comment.status !== 'approved' ? (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => statusMutation.mutate({ id: comment.id, status: 'approved' })}
                            disabled={statusMutation.isPending}
                          >
                            <Check className="h-3.5 w-3.5" />
                            通过
                          </Button>
                        ) : null}
                        {hasPermission('comment:update') && comment.status !== 'rejected' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => statusMutation.mutate({ id: comment.id, status: 'rejected' })}
                            disabled={statusMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                            拒绝
                          </Button>
                        ) : null}
                        {hasPermission('comment:delete') ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(comment)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border/70 px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={commentsQuery.data?.total ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="warning" dot>
          待审核
        </Badge>
        评论提交后默认进入待审核；站点设置中关闭「评论先审后发」将直接展示。
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除评论"
        description={
          deleteTarget
            ? `确定删除「${deleteTarget.nickname}」的评论吗？该操作不可撤销。`
            : undefined
        }
        confirmText="删除"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMutation.mutateAsync(deleteTarget.id);
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(batchAction)}
        onOpenChange={(open) => {
          if (!open) setBatchAction(null);
        }}
        title={batchAction ? BATCH_META[batchAction].title : '批量操作'}
        description={
          batchAction
            ? `确定对选中的 ${selected.size} 条评论执行「${BATCH_META[batchAction].title}」吗？`
            : undefined
        }
        destructive={batchAction ? BATCH_META[batchAction].destructive : false}
        confirmText={batchAction ? BATCH_META[batchAction].confirmText : '确认'}
        onConfirm={async () => {
          if (!batchAction || !selected.size) return;
          try {
            await batchMutation.mutateAsync({ ids: Array.from(selected), action: batchAction });
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />
    </div>
  );
}

export default function CommentsPage() {
  return (
    <PermissionGate permission="comment:view">
      <CommentsContent />
    </PermissionGate>
  );
}
