'use client';

import type { PermissionGroup, Role } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PermissionMatrix } from '@/components/admin/system/permission-matrix';
import type { RoleInput } from '@/lib/api';

interface RoleFormState {
  name: string;
  code: string;
  description: string;
  permissionCodes: string[];
}

const EMPTY_FORM: RoleFormState = {
  name: '',
  code: '',
  description: '',
  permissionCodes: [],
};

export interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  groups: PermissionGroup[];
  saving: boolean;
  onSubmit: (input: RoleInput) => void;
}

export function RoleFormDialog({ open, onOpenChange, role, groups, saving, onSubmit }: RoleFormDialogProps) {
  const [form, setForm] = React.useState<RoleFormState>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (role) {
      setForm({
        name: role.name,
        code: role.code,
        description: role.description ?? '',
        permissionCodes: role.permissions.map((permission) => permission.code),
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setError(null);
  }, [open, role]);

  const handleSubmit = () => {
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name) {
      setError('请填写角色名称');
      return;
    }
    if (!role && !/^[a-z][a-z0-9_]*$/.test(code)) {
      setError('角色标识需以小写字母开头，只能包含小写字母、数字与下划线');
      return;
    }
    setError(null);
    onSubmit({
      name,
      code: role ? role.code : code,
      description: form.description.trim() || null,
      permissionCodes: form.permissionCodes,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={role ? `编辑角色 · ${role.name}` : '新建角色'}
      description={role?.isSystem ? '内置角色可调整权限，但角色标识与名称建议保持不变。' : '角色标识创建后不可修改。'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {role ? '保存修改' : '创建角色'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="角色名称" required htmlFor="role-name">
            <Input
              id="role-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="内容编辑"
              disabled={saving}
            />
          </Field>
          <Field
            label="角色标识 code"
            required={!role}
            hint={role ? '创建后不可修改' : '如 content_editor'}
            htmlFor="role-code"
          >
            <Input
              id="role-code"
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="content_editor"
              disabled={saving || Boolean(role)}
              className="font-mono"
            />
          </Field>
          <Field label="角色描述" htmlFor="role-description" className="sm:col-span-2">
            <Textarea
              id="role-description"
              rows={2}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="一句话描述该角色的职责范围"
              disabled={saving}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">权限配置</p>
          <PermissionMatrix
            groups={groups}
            value={form.permissionCodes}
            onChange={(codes) => setForm((prev) => ({ ...prev, permissionCodes: codes }))}
            disabled={saving}
          />
        </div>
      </div>
    </Dialog>
  );
}
