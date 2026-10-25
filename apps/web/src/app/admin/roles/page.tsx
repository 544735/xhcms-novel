'use client';

import type { Role } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { RoleFormDialog } from '@/components/admin/system/role-form-dialog';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { api, ApiError, type RoleInput } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

function RolesContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Role | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword]);

  const rolesQuery = useQuery({
    queryKey: ['roles', 'list', page, pageSize, debouncedKeyword],
    queryFn: () =>
      api.roles.list({ page, pageSize, keyword: debouncedKeyword || undefined }),
  });

  const groupsQuery = useQuery({
    queryKey: ['permissions', 'groups'],
    queryFn: () => api.permissions.groups(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['roles'] });
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: RoleInput }) =>
      id ? api.roles.update(id, input) : api.roles.create(input),
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? '角色已更新' : '角色创建成功');
      invalidate();
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '保存失败，请稍后重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.roles.remove(id),
    onSuccess: () => {
      toast.success('角色已删除');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const items = rolesQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="角色权限"
        description="通过角色集中管理权限点；权限变更即时生效，无需重新登录。"
        actions={
          <>
            <Button variant="outline" onClick={() => void rolesQuery.refetch()} disabled={rolesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {hasPermission('role:create') ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建角色
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>角色列表</CardTitle>
            <CardDescription className="mt-1">
              共 {rolesQuery.data?.total ?? 0} 个角色 · 权限点目录由系统统一定义
            </CardDescription>
          </div>
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索角色名称或标识"
            className="w-full sm:w-64"
          />
        </CardHeader>

        {rolesQuery.isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : rolesQuery.isError ? (
          <CardContent>
            <QueryErrorState
              title="角色列表加载失败"
              description={
                rolesQuery.error instanceof ApiError ? rolesQuery.error.message : '无法获取角色数据，请稍后重试。'
              }
              onRetry={() => void rolesQuery.refetch()}
            />
          </CardContent>
        ) : !items.length ? (
          <CardContent>
            <EmptyState
              icon={ShieldCheck}
              title={debouncedKeyword ? '没有匹配的角色' : '还没有角色'}
              description={
                debouncedKeyword
                  ? '尝试调整搜索关键词。'
                  : '创建角色并勾选权限点，再把角色分配给管理员即可完成授权。'
              }
              action={
                hasPermission('role:create') ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    新建角色
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>角色</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>权限数</TableHead>
                  <TableHead>管理员数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{role.name}</span>
                        {role.isSystem ? <Badge variant="secondary">内置</Badge> : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{role.code}</p>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2 max-w-xs text-xs text-muted-foreground">
                        {role.description || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{role.permissions.length}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{role.userCount}</span>
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(role.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`操作 ${role.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                        items={[
                          {
                            label: '编辑角色与权限',
                            icon: <Pencil className="h-3.5 w-3.5" />,
                            disabled: !hasPermission('role:update'),
                            onSelect: () => openEdit(role),
                          },
                          {
                            label: '删除角色',
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            danger: true,
                            separatorBefore: true,
                            disabled: role.isSystem || !hasPermission('role:delete'),
                            onSelect: () => setDeleteTarget(role),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border/70 px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={rolesQuery.data?.total ?? 0}
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

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        role={editing}
        groups={groupsQuery.data ?? []}
        saving={saveMutation.isPending}
        onSubmit={(input) => saveMutation.mutate({ id: editing?.id, input })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除角色"
        description={
          deleteTarget
            ? `确定删除角色「${deleteTarget.name}」吗？若仍有管理员使用该角色，接口会拒绝删除。`
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

export default function RolesPage() {
  return (
    <PermissionGate permission="role:view">
      <RolesContent />
    </PermissionGate>
  );
}
