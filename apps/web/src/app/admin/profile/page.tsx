'use client';

import type { UserProfile } from '@wmcms/shared';
import { useMutation } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { toast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

function ProfileCard({ user }: { user: UserProfile }) {
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
      toast.success('资料已刷新');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>账号资料</CardTitle>
          <CardDescription className="mt-1">资料由超级管理员维护，如需修改请联系管理员。</CardDescription>
        </div>
        <Button variant="outline" size="sm" loading={refreshing} onClick={() => void handleRefresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar size="lg" src={user.avatar} name={user.nickname ?? user.username} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
              {user.nickname ?? user.username}
              <StatusBadge status={user.status} />
              {user.isSuperAdmin ? <Badge variant="purple">超级管理员</Badge> : null}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">邮箱</dt>
              <dd className="truncate text-sm text-foreground">{user.email || '—'}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">角色</dt>
              <dd className="flex flex-wrap gap-1 pt-0.5">
                {user.roles.length ? (
                  user.roles.map((role) => (
                    <Badge key={role.id} variant="secondary">
                      {role.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-foreground">未分配</span>
                )}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">可访问站点</dt>
              <dd className="text-sm text-foreground">
                {user.isSuperAdmin
                  ? '全部站点（超级管理员）'
                  : user.sites.length
                    ? user.sites.map((site) => site.name).join('、')
                    : '未授权站点'}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">权限点数量</dt>
              <dd className="text-sm text-foreground">{user.isSuperAdmin ? '全部权限' : `${user.permissions.length} 项`}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">最后登录</dt>
              <dd className="text-sm text-foreground">{formatDateTime(user.lastLoginAt)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">账号创建时间</dt>
              <dd className="text-sm text-foreground">{formatDateTime(user.createdAt)}</dd>
            </div>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard() {
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const changeMutation = useMutation({
    mutationFn: (input: { oldPassword: string; newPassword: string }) => api.auth.changePassword(input),
    onSuccess: () => {
      toast.success('密码修改成功', { description: '下次登录请使用新密码。' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : '密码修改失败，请稍后重试');
    },
  });

  const handleSubmit = () => {
    if (!oldPassword) {
      setError('请输入当前密码');
      return;
    }
    if (newPassword.length < 8) {
      setError('新密码长度不能少于 8 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword === oldPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }
    setError(null);
    changeMutation.mutate({ oldPassword, newPassword });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>修改密码</CardTitle>
        <CardDescription>为账号设置新密码，至少 8 位。</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </div>
          ) : null}

          <Field label="当前密码" required htmlFor="profile-old-password">
            <Input
              id="profile-old-password"
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              placeholder="输入当前密码"
              autoComplete="current-password"
              disabled={changeMutation.isPending}
            />
          </Field>
          <Field label="新密码" required htmlFor="profile-new-password" hint="至少 8 位">
            <Input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="输入新密码"
              autoComplete="new-password"
              disabled={changeMutation.isPending}
            />
          </Field>
          <Field label="确认新密码" required htmlFor="profile-confirm-password">
            <Input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
              disabled={changeMutation.isPending}
            />
          </Field>

          <Button type="submit" className="w-full" loading={changeMutation.isPending}>
            <KeyRound className="h-4 w-4" />
            修改密码
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            修改成功后当前登录状态保持有效；建议同时更新密码管理工具中的记录。
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <PageHeader title="个人资料" description="查看当前登录账号信息，并修改登录密码。" />

      {user ? (
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <ProfileCard user={user} />
          <ChangePasswordCard />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">正在加载账号信息…</p>
        </div>
      )}
    </div>
  );
}
