'use client';

import type { AdminUser, RoleSummary, SiteSummary } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { UserFormDialog } from '@/components/admin/system/user-form-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/input';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { api, ApiError, type UserInput } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

function UsersContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const viewerIsSuperAdmin = isSuperAdmin();

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<AdminUser | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, status]);

  const usersQuery = useQuery({
    queryKey: ['users', 'list', page, pageSize, debouncedKeyword, status],
    queryFn: () =>
      api.users.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
        status: status === 'all' ? undefined : status,
      }),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles', 'options'],
    queryFn: () => api.roles.options(),
  });

  const sitesQuery = useQuery({
    queryKey: ['sites', 'options'],
    queryFn: () => api.sites.options(),
  });

  const roles: RoleSummary[] = rolesQuery.data ?? [];
  const sites: SiteSummary[] = sitesQuery.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: UserInput }) =>
      id ? api.users.update(id, input) : api.users.create(input),
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? '管理员信息已更新' : '管理员创建成功');
      invalidate();
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '保存失败，请稍后重试');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: 'active' | 'disabled' }) =>
      api.users.setStatus(id, nextStatus),
    onSuccess: (_data, variables) => {
      toast.success(variables.nextStatus === 'active' ? '账号已启用' : '账号已禁用');
      invalidate();
      setStatusTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '状态更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => {
      toast.success('管理员已删除');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const items = usersQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理员"
        description="管理后台账号、角色与站点授权。超级管理员可分配全部角色与站点。"
        actions={
          <>
            <Button variant="outline" onClick={() => void usersQuery.refetch()} disabled={usersQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {hasPermission('user:create') ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建管理员
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle>账号列表</CardTitle>
            <CardDescription className="mt-1">共 {usersQuery.data?.total ?? 0} 个管理员账号</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索账号、昵称或邮箱"
              className="w-full sm:w-64"
            />
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full sm:w-32"
              aria-label="按状态筛选"
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">停用</option>
            </Select>
          </div>
        </CardHeader>

        {usersQuery.isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : usersQuery.isError ? (
          <CardContent>
            <QueryErrorState
              title="管理员列表加载失败"
              description={
                usersQuery.error instanceof ApiError ? usersQuery.error.message : '无法获取管理员数据，请稍后重试。'
              }
              onRetry={() => void usersQuery.refetch()}
            />
          </CardContent>
        ) : !items.length ? (
          <CardContent>
            <EmptyState
              icon={ShieldCheck}
              title={debouncedKeyword || status !== 'all' ? '没有匹配的管理员' : '还没有管理员账号'}
              description={
                debouncedKeyword || status !== 'all'
                  ? '尝试调整搜索关键词或状态筛选。'
                  : '创建管理员并分配角色，即可协同管理站点内容。'
              }
              action={
                hasPermission('user:create') ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    新建管理员
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
                  <TableHead>管理员</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>站点</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((user) => {
                  const self = user.id === currentUserId;
                  const siteNames = user.sites.map((site) => site.name);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm" src={user.avatar} name={user.nickname ?? user.username} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                              {user.nickname ?? user.username}
                              {self ? <Badge variant="info">自己</Badge> : null}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{user.email || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.isSuperAdmin ? <Badge variant="purple">超级管理员</Badge> : null}
                          {user.roles.length ? (
                            user.roles.map((role) => (
                              <Badge key={role.id} variant="secondary">
                                {role.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">未分配</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {user.isSuperAdmin
                            ? '全部站点'
                            : siteNames.length
                              ? `${siteNames.slice(0, 2).join('、')}${siteNames.length > 2 ? ` +${siteNames.length - 2}` : ''}`
                              : '未授权'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(user.lastLoginAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`操作 ${user.username}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                          items={[
                            {
                              label: '编辑账号',
                              icon: <Pencil className="h-3.5 w-3.5" />,
                              disabled: !hasPermission('user:update'),
                              onSelect: () => openEdit(user),
                            },
                            {
                              label: user.status === 'active' ? '禁用账号' : '启用账号',
                              icon:
                                user.status === 'active' ? (
                                  <UserX className="h-3.5 w-3.5" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5" />
                                ),
                              disabled: self || !hasPermission('user:update'),
                              onSelect: () => setStatusTarget(user),
                            },
                            {
                              label: '删除账号',
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              danger: true,
                              separatorBefore: true,
                              disabled: self || !hasPermission('user:delete'),
                              onSelect: () => setDeleteTarget(user),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="border-t border-border/70 px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={usersQuery.data?.total ?? 0}
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

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        user={editing}
        roles={roles}
        sites={sites}
        saving={saveMutation.isPending}
        canAssignSuperAdmin={viewerIsSuperAdmin}
        onSubmit={(input) => saveMutation.mutate({ id: editing?.id, input })}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
        title={statusTarget?.status === 'active' ? '禁用账号' : '启用账号'}
        description={
          statusTarget
            ? statusTarget.status === 'active'
              ? `确定禁用「${statusTarget.username}」吗？禁用后该账号将无法登录后台。`
              : `确定启用「${statusTarget.username}」吗？启用后该账号可正常登录。`
            : undefined
        }
        destructive={statusTarget?.status === 'active'}
        confirmText={statusTarget?.status === 'active' ? '禁用' : '启用'}
        onConfirm={async () => {
          if (!statusTarget) return;
          try {
            await statusMutation.mutateAsync({
              id: statusTarget.id,
              nextStatus: statusTarget.status === 'active' ? 'disabled' : 'active',
            });
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除管理员"
        description={
          deleteTarget
            ? `确定删除管理员「${deleteTarget.username}」吗？该操作不可撤销。`
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

export default function UsersPage() {
  return (
    <PermissionGate permission="user:view">
      <UsersContent />
    </PermissionGate>
  );
}
