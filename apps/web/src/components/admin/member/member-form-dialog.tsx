'use client';

import type { Member } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import type { MemberInput } from '@/lib/api';

interface MemberFormState {
  username: string;
  email: string;
  nickname: string;
  password: string;
  status: 'active' | 'disabled';
  points: string;
}

const EMPTY_FORM: MemberFormState = {
  username: '',
  email: '',
  nickname: '',
  password: '',
  status: 'active',
  points: '0',
};

function toForm(member: Member | null): MemberFormState {
  if (!member) return { ...EMPTY_FORM };
  return {
    username: member.username,
    email: member.email,
    nickname: member.nickname ?? '',
    password: '',
    status: member.status,
    points: String(member.points ?? 0),
  };
}

export interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  saving: boolean;
  onSubmit: (input: MemberInput) => void;
}

export function MemberFormDialog({ open, onOpenChange, member, saving, onSubmit }: MemberFormDialogProps) {
  const [form, setForm] = React.useState<MemberFormState>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(toForm(member));
    setError(null);
  }, [open, member]);

  const update = <K extends keyof MemberFormState>(key: K, value: MemberFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const username = form.username.trim();
    const email = form.email.trim();
    const points = Number(form.points);
    if (!username) {
      setError('请填写会员账号');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请填写有效的邮箱地址');
      return;
    }
    if (!member && !form.password) {
      setError('新建会员时必须设置初始密码');
      return;
    }
    if (form.password && form.password.length < 8) {
      setError('密码长度不能少于 8 位');
      return;
    }
    if (!Number.isFinite(points) || points < 0) {
      setError('积分需为不小于 0 的数字');
      return;
    }
    setError(null);
    onSubmit({
      username,
      email,
      nickname: form.nickname.trim() || null,
      status: form.status,
      points,
      ...(form.password ? { password: form.password } : {}),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `编辑会员 · ${member.username}` : '新建会员'}
      description="会员用于门户登录、评论与积分体系；密码留空表示不修改。"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {member ? '保存修改' : '创建会员'}
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
          <Field label="会员账号" required htmlFor="member-username">
            <Input
              id="member-username"
              value={form.username}
              onChange={(event) => update('username', event.target.value)}
              placeholder="alice"
              disabled={saving || Boolean(member)}
              autoComplete="off"
            />
          </Field>
          <Field label="邮箱" required htmlFor="member-email">
            <Input
              id="member-email"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="alice@example.com"
              disabled={saving}
            />
          </Field>
          <Field label="昵称" htmlFor="member-nickname">
            <Input
              id="member-nickname"
              value={form.nickname}
              onChange={(event) => update('nickname', event.target.value)}
              placeholder="爱丽丝"
              disabled={saving}
            />
          </Field>
          <Field label="积分" htmlFor="member-points" hint="用于会员等级/权益（可选）">
            <Input
              id="member-points"
              type="number"
              min={0}
              value={form.points}
              onChange={(event) => update('points', event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field
            label={member ? '重置密码' : '初始密码'}
            required={!member}
            hint="至少 8 位；编辑时留空表示不修改"
            htmlFor="member-password"
          >
            <Input
              id="member-password"
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder={member ? '留空表示不修改' : '至少 8 位'}
              autoComplete="new-password"
              disabled={saving}
            />
          </Field>
          <Field label="状态" htmlFor="member-status">
            <Select
              id="member-status"
              value={form.status}
              onChange={(event) => update('status', event.target.value as MemberFormState['status'])}
              disabled={saving}
            >
              <option value="active">正常</option>
              <option value="disabled">禁用</option>
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
