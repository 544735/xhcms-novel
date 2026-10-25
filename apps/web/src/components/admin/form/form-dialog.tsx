'use client';

import type { Form, FormField } from '@wmcms/shared';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { FormInput } from '@/lib/api';

const FIELD_TYPE_OPTIONS: { value: FormField['type']; label: string }[] = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'email', label: '邮箱' },
  { value: 'tel', label: '电话' },
  { value: 'number', label: '数字' },
  { value: 'select', label: '下拉选择' },
  { value: 'radio', label: '单选' },
  { value: 'checkbox', label: '多选' },
  { value: 'date', label: '日期' },
];

const OPTION_TYPES = new Set<FormField['type']>(['select', 'radio', 'checkbox']);

interface FieldDraft {
  uid: string;
  key: string;
  label: string;
  type: FormField['type'];
  required: boolean;
  placeholder: string;
  maxLength: string;
  optionsText: string;
}

interface FormDraft {
  name: string;
  slug: string;
  description: string;
  status: 'enabled' | 'disabled';
  successMessage: string;
  fields: FieldDraft[];
}

let uidSeed = 0;
function nextUid(): string {
  uidSeed += 1;
  return `field-${Date.now().toString(36)}-${uidSeed}`;
}

function toDraft(form: Form | null): FormDraft {
  if (!form) {
    return {
      name: '',
      slug: '',
      description: '',
      status: 'enabled',
      successMessage: '',
      fields: [
        {
          uid: nextUid(),
          key: 'email',
          label: '邮箱',
          type: 'email',
          required: true,
          placeholder: '',
          maxLength: '',
          optionsText: '',
        },
      ],
    };
  }
  return {
    name: form.name,
    slug: form.slug,
    description: form.description ?? '',
    status: form.status,
    successMessage: form.successMessage ?? '',
    fields: (form.fields ?? []).map((field) => ({
      uid: nextUid(),
      key: field.key,
      label: field.label,
      type: field.type,
      required: Boolean(field.required),
      placeholder: field.placeholder ?? '',
      maxLength: field.maxLength ? String(field.maxLength) : '',
      optionsText: (field.options ?? []).join(', '),
    })),
  };
}

function parseOptions(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: Form | null;
  saving: boolean;
  onSubmit: (input: FormInput) => void;
}

export function FormDialog({ open, onOpenChange, form, saving, onSubmit }: FormDialogProps) {
  const [draft, setDraft] = React.useState<FormDraft>(() => toDraft(null));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(toDraft(form));
    setError(null);
  }, [open, form]);

  const updateField = (index: number, patch: Partial<FieldDraft>) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    }));
  };

  const addField = () => {
    setDraft((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          uid: nextUid(),
          key: '',
          label: '',
          type: 'text',
          required: false,
          placeholder: '',
          maxLength: '',
          optionsText: '',
        },
      ],
    }));
  };

  const removeField = (index: number) => {
    setDraft((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }));
  };

  const moveField = (index: number, direction: -1 | 1) => {
    setDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.fields.length) return prev;
      const fields = [...prev.fields];
      const [moved] = fields.splice(index, 1);
      if (!moved) return prev;
      fields.splice(target, 0, moved);
      return { ...prev, fields };
    });
  };

  const handleSubmit = () => {
    const name = draft.name.trim();
    if (!name) {
      setError('请填写表单名称');
      return;
    }
    const slug = draft.slug.trim();
    if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      setError('表单标识只能包含小写字母、数字与连字符');
      return;
    }
    if (!draft.fields.length) {
      setError('请至少添加一个表单字段');
      return;
    }

    const keys = new Set<string>();
    const fields: FormField[] = [];
    for (const [index, field] of draft.fields.entries()) {
      const key = field.key.trim();
      const label = field.label.trim();
      if (!key) {
        setError(`第 ${index + 1} 个字段缺少字段 key`);
        return;
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        setError(`字段 key「${key}」不合法：需以字母或下划线开头，仅含字母、数字、下划线`);
        return;
      }
      if (keys.has(key)) {
        setError(`字段 key「${key}」重复，请保持唯一`);
        return;
      }
      keys.add(key);
      if (!label) {
        setError(`字段「${key}」缺少显示标签`);
        return;
      }
      const options = OPTION_TYPES.has(field.type) ? parseOptions(field.optionsText) : [];
      if (OPTION_TYPES.has(field.type) && !options.length) {
        setError(`字段「${label}」为选择类型，请至少填写一个选项`);
        return;
      }
      let maxLength: number | undefined;
      if (field.maxLength.trim()) {
        maxLength = Number(field.maxLength);
        if (!Number.isInteger(maxLength) || maxLength <= 0) {
          setError(`字段「${label}」的最大长度需为正整数`);
          return;
        }
      }
      fields.push({
        key,
        label,
        type: field.type,
        required: field.required || undefined,
        placeholder: field.placeholder.trim() || undefined,
        options: OPTION_TYPES.has(field.type) ? options : undefined,
        maxLength,
      });
    }

    setError(null);
    onSubmit({
      name,
      slug: slug || undefined,
      description: draft.description.trim() || null,
      status: draft.status,
      successMessage: draft.successMessage.trim() || null,
      fields,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={form ? `编辑表单 · ${form.name}` : '新建表单'}
      description="设计表单字段后，门户可通过 slug 渲染并收集提交数据。"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {form ? '保存修改' : '创建表单'}
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
          <Field label="表单名称" required htmlFor="form-name">
            <Input
              id="form-name"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="联系我们"
              disabled={saving}
            />
          </Field>
          <Field label="表单标识 slug" hint="用于门户提交接口，留空自动生成" htmlFor="form-slug">
            <Input
              id="form-slug"
              value={draft.slug}
              onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="contact"
              disabled={saving || Boolean(form)}
            />
          </Field>
          <Field label="表单描述" htmlFor="form-description" className="sm:col-span-2">
            <Textarea
              id="form-description"
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="简要说明该表单的用途"
              disabled={saving}
            />
          </Field>
          <Field label="提交成功提示" htmlFor="form-success" className="sm:col-span-2">
            <Input
              id="form-success"
              value={draft.successMessage}
              onChange={(event) => setDraft((prev) => ({ ...prev, successMessage: event.target.value }))}
              placeholder="提交成功，我们会尽快与你联系。"
              disabled={saving}
            />
          </Field>
          <Field label="表单状态" htmlFor="form-status">
            <Select
              id="form-status"
              value={draft.status}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, status: event.target.value as FormDraft['status'] }))
              }
              disabled={saving}
            >
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">表单字段</p>
              <p className="text-xs text-muted-foreground">支持增删与排序；选择类型需填写选项（逗号分隔）。</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addField} disabled={saving}>
              <Plus className="h-3.5 w-3.5" />
              添加字段
            </Button>
          </div>

          {draft.fields.length ? (
            <div className="space-y-3">
              {draft.fields.map((field, index) => (
                <div key={field.uid} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      字段 {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveField(index, -1)}
                        disabled={saving || index === 0}
                        aria-label="上移字段"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveField(index, 1)}
                        disabled={saving || index === draft.fields.length - 1}
                        aria-label="下移字段"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeField(index)}
                        disabled={saving}
                        aria-label="删除字段"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="字段 key" required>
                      <Input
                        value={field.key}
                        onChange={(event) => updateField(index, { key: event.target.value })}
                        placeholder="email"
                        className="font-mono"
                        disabled={saving}
                      />
                    </Field>
                    <Field label="显示标签" required>
                      <Input
                        value={field.label}
                        onChange={(event) => updateField(index, { label: event.target.value })}
                        placeholder="邮箱"
                        disabled={saving}
                      />
                    </Field>
                    <Field label="类型">
                      <Select
                        value={field.type}
                        onChange={(event) =>
                          updateField(index, { type: event.target.value as FormField['type'] })
                        }
                        disabled={saving}
                      >
                        {FIELD_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="占位提示">
                      <Input
                        value={field.placeholder}
                        onChange={(event) => updateField(index, { placeholder: event.target.value })}
                        placeholder="请输入邮箱"
                        disabled={saving}
                      />
                    </Field>
                    <Field label="最大长度" hint="可选，正整数">
                      <Input
                        value={field.maxLength}
                        onChange={(event) => updateField(index, { maxLength: event.target.value })}
                        placeholder="100"
                        inputMode="numeric"
                        disabled={saving}
                      />
                    </Field>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 sm:col-span-1">
                      <span className="text-xs font-medium text-foreground">必填</span>
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => updateField(index, { required: checked })}
                        disabled={saving}
                        aria-label={`字段 ${field.label || field.key} 必填`}
                      />
                    </div>
                    {OPTION_TYPES.has(field.type) ? (
                      <Field label="选项（逗号分隔）" required className="sm:col-span-2 lg:col-span-2">
                        <Input
                          value={field.optionsText}
                          onChange={(event) => updateField(index, { optionsText: event.target.value })}
                          placeholder="选项一, 选项二, 选项三"
                          disabled={saving}
                        />
                      </Field>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              还没有字段，点击「添加字段」开始设计表单。
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
