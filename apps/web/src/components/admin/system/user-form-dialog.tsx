'use client';

import type { AdminUser, RoleSummary, SiteSummary } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { UserInput } from '@/lib/api';

interface UserFormState {
  username: string;
  email: string;
  nickname: string;
  password: string;
  status: 'active' | 'disabled';
  isSuperAdmin: boolean;
  roleIds: string[];
  siteIds: string[];
}

const EMPTY_FORM: UserFormState = {
  username: '',
  email: '',
  nickname: '',
  password: '',
  status: 'active',
  isSuperAdmin: false,
  roleIds: [],
  siteIds: [],
};

function toForm(user: AdminUser | null): UserFormState {
  if (!user) return { ...EMPTY_FORM };
  return {
    username: user.username,
    email: user.email,
    nickname: user.nickname ?? '',
    password: '',
    status: user.status,
    isSuperAdmin: user.isSuperAdmin,
    roleIds: user.roleIds ?? [],
    siteIds: user.siteIds ?? [],
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  roles: RoleSummary[];
  sites: SiteSummary[];
  saving: boolean;
  canAssignSuperAdmin: boolean;
  onSubmit: (input: UserInput) => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  roles,
  sites,
  saving,
  canAssignSuperAdmin,
  onSubmit,
}: UserFormDialogProps) {
  const [form, setForm] = React.useState<UserFormState>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(toForm(user));
    setError(null);
  }, [open, user]);

  const update = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const username = form.username.trim();
    const email = form.email.trim();
    if (!username) {
      setError('请填写登录账号');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请填写有效的邮箱地址');
      return;
    }
    if (!user && !form.password) {
      setError('新建管理员时必须设置初始密码');
      return;
    }
    if (form.password && form.password.length < 8) {
      setError('密码长度不能少于 8 位');
      return;
    }
    setError(null);
    onSubmit({
      username,
      email,
      nickname: form.nickname.trim() || null,
      status: form.status,
      roleIds: form.roleIds,
      siteIds: form.siteIds,
      ...(canAssignSuperAdmin ? { isSuperAdmin: form.isSuperAdmin } : {}),
      ...(form.password ? { password: form.password } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={user ? `编辑管理员 · ${user.username}` : '新建管理员'}
      description="分配角色与可访问站点；权限由所绑定角色决定。"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {user ? '保存修改' : '创建管理员'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="登录账号" required htmlFor="user-username">
            <Input
              id="user-username"
              value={form.username}
              onChange={(event) => update('username', event.target.value)}
              placeholder="editor"
              disabled={saving || Boolean(user)}
              autoComplete="off"
            />
          </Field>
          <Field label="邮箱" required htmlFor="user-email">
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="editor@example.com"
              disabled={saving}
            />
          </Field>
          <Field label="昵称" htmlFor="user-nickname">
            <Input
              id="user-nickname"
              value={form.nickname}
              onChange={(event) => update('nickname', event.target.value)}
              placeholder="内容编辑"
              disabled={saving}
            />
          </Field>
          <Field label="状态" htmlFor="user-status">
            <Select
              id="user-status"
              value={form.status}
              onChange={(event) => update('status', event.target.value as UserFormState['status'])}
              disabled={saving}
            >
              <option value="active">启用</option>
              <option value="disabled">禁用</option>
            </Select>
          </Field>
          <Field
            label={user ? '重置密码' : '初始密码'}
            required={!user}
            hint={user ? '留空则不修改密码' : '至少 8 位'}
            htmlFor="user-password"
            className="sm:col-span-2"
          >
            <Input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder={user ? '留空表示不修改' : '至少 8 位'}
              autoComplete="new-password"
              disabled={saving}
            />
          </Field>
        </div>

        {canAssignSuperAdmin ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">超级管理员</p>
              <p className="text-xs text-muted-foreground">超级管理员拥有全部权限，且不受站点授权限制。</p>
            </div>
            <Switch
              checked={form.isSuperAdmin}
              onCheckedChange={(checked) => update('isSuperAdmin', checked)}
              disabled={saving}
              aria-label="超级管理员"
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">角色</p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2">
              {roles.length ? (
                roles.map((role) => (
                  <label
                    key={role.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                      form.roleIds.includes(role.id) && 'bg-muted/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={form.roleIds.includes(role.id)}
                      onChange={() => update('roleIds', toggleId(form.roleIds, role.id))}
                      disabled={saving}
                    />
                    <span className="truncate text-foreground">{role.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{role.code}</span>
                  </label>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">暂无可用角色</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">可访问站点</p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2">
              {sites.length ? (
                sites.map((site) => (
                  <label
                    key={site.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted',
                      form.siteIds.includes(site.id) && 'bg-muted/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={form.siteIds.includes(site.id)}
                      onChange={() => update('siteIds', toggleId(form.siteIds, site.id))}
                      disabled={saving}
                    />
                    <span className="truncate text-foreground">{site.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">/{site.slug}</span>
                  </label>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">暂无可授权站点</p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">超级管理员无需勾选也可访问全部站点。</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
