'use client';

import type { Form, FormSubmission } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Inbox, MailOpen, Mail, Trash2 } from 'lucide-react';
import * as React from 'react';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export interface SubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form | null;
}

export function SubmissionsDialog({ open, onOpenChange, form }: SubmissionsDialogProps) {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<FormSubmission | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPage(1);
    setExpanded(new Set());
  }, [open, form?.id]);

  const submissionsQuery = useQuery({
    queryKey: ['forms', form?.id, 'submissions', page, pageSize],
    queryFn: () => api.forms.submissions(form!.id, { page, pageSize }),
    enabled: Boolean(open && form?.id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['forms'] });
  };

  const markReadMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => api.forms.markRead(id, read),
    onSuccess: (_data, variables) => {
      toast.success(variables.read ? '已标记为已读' : '已标记为未读');
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['forms', form?.id, 'submissions'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '操作失败，请稍后重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.forms.removeSubmission(id),
    onSuccess: () => {
      toast.success('提交记录已删除');
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['forms', form?.id, 'submissions'] });
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const items = submissionsQuery.data?.items ?? [];

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={form ? `提交记录 · ${form.name}` : '提交记录'}
        description={form ? `共 ${submissionsQuery.data?.total ?? form.submissionCount} 条提交，可标记已读或删除。` : undefined}
        size="xl"
        footer={
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        }
      >
        {submissionsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : submissionsQuery.isError ? (
          <QueryErrorState
            title="提交记录加载失败"
            description={
              submissionsQuery.error instanceof ApiError
                ? submissionsQuery.error.message
                : '无法获取提交数据，请稍后重试。'
            }
            onRetry={() => void submissionsQuery.refetch()}
          />
        ) : !items.length ? (
          <EmptyState
            icon={Inbox}
            title="还没有提交记录"
            description="门户提交该表单后，数据会出现在这里。"
          />
        ) : (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>提交时间</TableHead>
                  <TableHead>数据摘要</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((submission) => {
                  const isOpen = expanded.has(submission.id);
                  const summary = form?.fields?.length
                    ? form.fields
                        .slice(0, 4)
                        .map((field) => `${field.label}：${formatValue(submission.data[field.key])}`)
                        .join(' ｜ ')
                    : Object.entries(submission.data)
                        .slice(0, 4)
                        .map(([key, value]) => `${key}：${formatValue(value)}`)
                        .join(' ｜ ');
                  return (
                    <React.Fragment key={submission.id}>
                      <TableRow>
                        <TableCell>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(submission.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-md truncate text-xs text-foreground/85" title={summary}>
                            {summary || '—'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {submission.ip ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={submission.read ? 'secondary' : 'warning'} dot>
                            {submission.read ? '已读' : '未读'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleExpanded(submission.id)}
                              aria-expanded={isOpen}
                            >
                              {isOpen ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                              详情
                            </Button>
                            {hasPermission('form:update') ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={markReadMutation.isPending}
                                onClick={() =>
                                  markReadMutation.mutate({ id: submission.id, read: !submission.read })
                                }
                              >
                                {submission.read ? (
                                  <Mail className="h-3.5 w-3.5" />
                                ) : (
                                  <MailOpen className="h-3.5 w-3.5" />
                                )}
                                {submission.read ? '标为未读' : '标记已读'}
                              </Button>
                            ) : null}
                            {hasPermission('form:delete') ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleteTarget(submission)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                删除
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <pre className="max-h-72 overflow-auto rounded-lg border border-border/70 bg-card p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                              {JSON.stringify(submission.data, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={submissionsQuery.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除提交记录"
        description="确定删除该条提交记录吗？该操作不可撤销。"
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
    </>
  );
}
