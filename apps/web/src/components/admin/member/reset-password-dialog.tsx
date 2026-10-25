'use client';

import type { Member } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';

export interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  saving: boolean;
  onSubmit: (password: string) => void;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  member,
  saving,
  onSubmit,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirm('');
    setError(null);
  }, [open]);

  const handleSubmit = () => {
    if (password.length < 8) {
      setError('新密码长度不能少于 8 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setError(null);
    onSubmit(password);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `重置密码 · ${member.username}` : '重置密码'}
      description="重置后会员需要使用新密码重新登录门户。"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            确认重置
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
        <Field label="新密码" required htmlFor="reset-password" hint="至少 8 位">
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入新密码"
            autoComplete="new-password"
            disabled={saving}
          />
        </Field>
        <Field label="确认新密码" required htmlFor="reset-password-confirm">
          <Input
            id="reset-password-confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
            disabled={saving}
          />
        </Field>
      </div>
    </Dialog>
  );
}
