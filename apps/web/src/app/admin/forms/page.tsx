'use client';

import type { Form } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormInput as FormIcon, Inbox, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import * as React from 'react';
import { FormDialog } from '@/components/admin/form/form-dialog';
import { SubmissionsDialog } from '@/components/admin/form/submissions-dialog';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeletonGrid } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { api, ApiError, type FormInput } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

function FormsContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Form | null>(null);
  const [viewingSubmissions, setViewingSubmissions] = React.useState<Form | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Form | null>(null);

  const formsQuery = useQuery({
    queryKey: ['forms', 'list'],
    queryFn: () => api.forms.list(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['forms'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FormInput }) =>
      id ? api.forms.update(id, input) : api.forms.create(input),
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? '表单已更新' : '表单创建成功');
      invalidate();
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '保存失败，请稍后重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.forms.remove(id),
    onSuccess: () => {
      toast.success('表单已删除');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const forms = formsQuery.data ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (form: Form) => {
    setEditing(form);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="表单收集"
        description="设计门户表单并查看提交数据；字段支持动态增删与排序。"
        actions={
          <>
            <Button variant="outline" onClick={() => void formsQuery.refetch()} disabled={formsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {hasPermission('form:create') ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建表单
              </Button>
            ) : null}
          </>
        }
      />

      {formsQuery.isLoading ? (
        <CardSkeletonGrid count={3} />
      ) : formsQuery.isError ? (
        <QueryErrorState
          title="表单列表加载失败"
          description={
            formsQuery.error instanceof ApiError ? formsQuery.error.message : '无法获取表单数据，请稍后重试。'
          }
          onRetry={() => void formsQuery.refetch()}
        />
      ) : !forms.length ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={FormIcon}
            title="还没有表单"
            description="创建「联系我们」「订阅周刊」等表单，收集访客提交的信息。"
            action={
              hasPermission('form:create') ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  新建表单
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{form.name}</span>
                  <StatusBadge status={form.status} />
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {form.description || '暂无表单描述'}
                </CardDescription>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">/{form.slug}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">字段数</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{form.fields?.length ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">提交数</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{form.submissionCount ?? 0}</p>
                  </div>
                </div>

                {form.fields?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {form.fields.slice(0, 5).map((field) => (
                      <Badge key={field.key} variant="outline">
                        {field.label}
                        {field.required ? <span className="text-destructive">*</span> : null}
                      </Badge>
                    ))}
                    {form.fields.length > 5 ? (
                      <Badge variant="secondary">+{form.fields.length - 5}</Badge>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">尚未配置字段</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                  <Button size="sm" variant="outline" onClick={() => setViewingSubmissions(form)}>
                    <Inbox className="h-3.5 w-3.5" />
                    查看提交
                  </Button>
                  {hasPermission('form:update') ? (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(form)}>
                      <Pencil className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                  ) : null}
                  {hasPermission('form:delete') ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(form)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        form={editing}
        saving={saveMutation.isPending}
        onSubmit={(input) => saveMutation.mutate({ id: editing?.id, input })}
      />

      <SubmissionsDialog
        open={Boolean(viewingSubmissions)}
        onOpenChange={(open) => {
          if (!open) setViewingSubmissions(null);
        }}
        form={viewingSubmissions}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除表单"
        description={
          deleteTarget
            ? `确定删除表单「${deleteTarget.name}」吗？表单的提交记录也会一并删除，且不可撤销。`
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
    </div>
  );
}

export default function FormsPage() {
  return (
    <PermissionGate permission="form:view">
      <FormsContent />
    </PermissionGate>
  );
}
