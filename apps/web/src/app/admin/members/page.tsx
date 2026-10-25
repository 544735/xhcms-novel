'use client';

import type { Member } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
} from 'lucide-react';
import * as React from 'react';
import { MemberFormDialog } from '@/components/admin/member/member-form-dialog';
import { ResetPasswordDialog } from '@/components/admin/member/reset-password-dialog';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { api, ApiError, type MemberInput } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

function MembersContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [resetTarget, setResetTarget] = React.useState<Member | null>(null);
  const [statusTarget, setStatusTarget] = React.useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Member | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, status]);

  const membersQuery = useQuery({
    queryKey: ['members', 'list', page, pageSize, debouncedKeyword, status],
    queryFn: () =>
      api.members.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
        status: status === 'all' ? undefined : status,
      }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['members'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: MemberInput }) =>
      id ? api.members.update(id, input) : api.members.create(input),
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? '会员信息已更新' : '会员创建成功');
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
      api.members.setStatus(id, nextStatus),
    onSuccess: (_data, variables) => {
      toast.success(variables.nextStatus === 'active' ? '会员已启用' : '会员已禁用');
      invalidate();
      setStatusTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '状态更新失败');
    },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.members.resetPassword(id, password),
    onSuccess: () => {
      toast.success('会员密码已重置');
      setResetTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '密码重置失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.members.remove(id),
    onSuccess: () => {
      toast.success('会员已删除');
      invalidate();
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const items = membersQuery.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditing(member);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="会员管理"
        description="管理门户注册会员、积分与账号状态，可代会员重置密码。"
        actions={
          <>
            <Button variant="outline" onClick={() => void membersQuery.refetch()} disabled={membersQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {hasPermission('member:create') ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建会员
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle>会员列表</CardTitle>
            <CardDescription className="mt-1">共 {membersQuery.data?.total ?? 0} 位会员</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索昵称、账号或邮箱"
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
              <option value="disabled">禁用</option>
            </Select>
          </div>
        </CardHeader>

        {membersQuery.isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : membersQuery.isError ? (
          <CardContent>
            <QueryErrorState
              title="会员列表加载失败"
              description={
                membersQuery.error instanceof ApiError ? membersQuery.error.message : '无法获取会员数据，请稍后重试。'
              }
              onRetry={() => void membersQuery.refetch()}
            />
          </CardContent>
        ) : !items.length ? (
          <CardContent>
            <EmptyState
              icon={UserRound}
              title={debouncedKeyword || status !== 'all' ? '没有匹配的会员' : '还没有会员'}
              description={
                debouncedKeyword || status !== 'all'
                  ? '尝试调整搜索关键词或状态筛选。'
                  : '门户会员注册后会出现在这里，也可以手动创建会员。'
              }
              action={
                hasPermission('member:create') ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    新建会员
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
                  <TableHead>会员</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>积分</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>评论数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm" src={member.avatar} name={member.nickname ?? member.username} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {member.nickname ?? member.username}
                          </p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            @{member.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{member.email || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-foreground">{member.points ?? 0}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={member.status} />
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(member.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{member.commentCount ?? '—'}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`操作 ${member.username}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                        items={[
                          {
                            label: '编辑会员',
                            icon: <Pencil className="h-3.5 w-3.5" />,
                            disabled: !hasPermission('member:update'),
                            onSelect: () => openEdit(member),
                          },
                          {
                            label: '重置密码',
                            icon: <KeyRound className="h-3.5 w-3.5" />,
                            disabled: !hasPermission('member:update'),
                            onSelect: () => setResetTarget(member),
                          },
                          {
                            label: member.status === 'active' ? '禁用会员' : '启用会员',
                            icon:
                              member.status === 'active' ? (
                                <UserX className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              ),
                            disabled: !hasPermission('member:update'),
                            onSelect: () => setStatusTarget(member),
                          },
                          {
                            label: '删除会员',
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            danger: true,
                            separatorBefore: true,
                            disabled: !hasPermission('member:delete'),
                            onSelect: () => setDeleteTarget(member),
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
                total={membersQuery.data?.total ?? 0}
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

      <MemberFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        member={editing}
        saving={saveMutation.isPending}
        onSubmit={(input) => saveMutation.mutate({ id: editing?.id, input })}
      />

      <ResetPasswordDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        member={resetTarget}
        saving={resetMutation.isPending}
        onSubmit={(password) => {
          if (!resetTarget) return;
          resetMutation.mutate({ id: resetTarget.id, password });
        }}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
        title={statusTarget?.status === 'active' ? '禁用会员' : '启用会员'}
        description={
          statusTarget
            ? statusTarget.status === 'active'
              ? `确定禁用会员「${statusTarget.username}」吗？禁用后该会员将无法登录门户。`
              : `确定启用会员「${statusTarget.username}」吗？`
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
        title="删除会员"
        description={
          deleteTarget ? `确定删除会员「${deleteTarget.username}」吗？该操作不可撤销。` : undefined
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

export default function MembersPage() {
  return (
    <PermissionGate permission="member:view">
      <MembersContent />
    </PermissionGate>
  );
}
