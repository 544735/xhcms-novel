'use client';

import type { CategoryNode, CategoryType, EntityStatus } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { api, type CategoryInput } from '@/lib/api';
import { errorText, isValidSlug, type CategoryOption } from './category-utils';

export interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑时传入，新建时为空 */
  category?: CategoryNode | null;
  /** 新建子栏目时预设的父栏目 */
  defaultParentId?: string | null;
  /** 可选的父栏目（已排除自身与后代） */
  parentOptions: CategoryOption[];
}

interface CategoryFormState {
  parentId: string;
  name: string;
  slug: string;
  type: CategoryType;
  description: string;
  icon: string;
  sort: string;
  status: EntityStatus;
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
  content: string;
}

interface FormErrors {
  name?: string;
  slug?: string;
}

const EMPTY_FORM: CategoryFormState = {
  parentId: '',
  name: '',
  slug: '',
  type: 'article',
  description: '',
  icon: '',
  sort: '0',
  status: 'enabled',
  seoTitle: '',
  seoKeywords: '',
  seoDescription: '',
  content: '',
};

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  defaultParentId,
  parentOptions,
}: CategoryDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<CategoryFormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<FormErrors>({});

  React.useEffect(() => {
    if (!open) return;
    setForm({
      parentId: category?.parentId ?? defaultParentId ?? '',
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      type: category?.type ?? 'article',
      description: category?.description ?? '',
      icon: category?.icon ?? '',
      sort: String(category?.sort ?? 0),
      status: category?.status ?? 'enabled',
      seoTitle: category?.seoTitle ?? '',
      seoKeywords: category?.seoKeywords ?? '',
      seoDescription: category?.seoDescription ?? '',
      content: category?.content ?? '',
    });
    setErrors({});
  }, [open, category, defaultParentId]);

  const updateForm = (patch: Partial<CategoryFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const mutation = useMutation({
    mutationFn: (input: CategoryInput) =>
      category ? api.categories.update(category.id, input) : api.categories.create(input),
    onSuccess: async () => {
      toast.success(category ? '栏目已更新' : '栏目已创建');
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(category ? '更新栏目失败' : '创建栏目失败', { description: errorText(error) });
    },
  });

  const handleSubmit = () => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = '请输入栏目名称';
    if (form.slug.trim() && !isValidSlug(form.slug)) {
      next.slug = 'slug 只能包含小写字母、数字与连字符';
    }
    setErrors(next);
    if (next.name ?? next.slug) return;

    mutation.mutate({
      parentId: form.parentId || null,
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      type: form.type,
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      sort: Number(form.sort) || 0,
      status: form.status,
      seoTitle: form.seoTitle.trim() || null,
      seoKeywords: form.seoKeywords.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      content: form.type === 'page' ? form.content : null,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? '编辑栏目' : '新建栏目'}
      description={
        category ? `正在编辑「${category.name}」` : '栏目用于组织文章，page 类型栏目可作为独立页面。'
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
            {category ? '保存修改' : '创建栏目'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="父栏目" htmlFor="category-parent" hint="留空表示顶级栏目">
          <Select
            id="category-parent"
            value={form.parentId}
            onChange={(event) => updateForm({ parentId: event.target.value })}
          >
            <option value="">顶级栏目</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {`${option.depth > 0 ? '— '.repeat(option.depth) : ''}${option.name}`}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="类型" htmlFor="category-type">
            <Select
              id="category-type"
              value={form.type}
              onChange={(event) => updateForm({ type: event.target.value as CategoryType })}
            >
              <option value="article">文章栏目</option>
              <option value="page">单页（page）</option>
            </Select>
          </Field>
          <Field label="排序" htmlFor="category-sort" hint="数字越小越靠前">
            <Input
              id="category-sort"
              type="number"
              value={form.sort}
              onChange={(event) => updateForm({ sort: event.target.value })}
            />
          </Field>
        </div>

        <Field label="名称" required error={errors.name} htmlFor="category-name">
          <Input
            id="category-name"
            value={form.name}
            onChange={(event) => {
              updateForm({ name: event.target.value });
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="如：科技资讯"
            maxLength={60}
          />
        </Field>

        <Field
          label="Slug"
          error={errors.slug}
          hint="留空自动生成；仅允许小写字母、数字与连字符"
          htmlFor="category-slug"
        >
          <Input
            id="category-slug"
            value={form.slug}
            onChange={(event) => {
              updateForm({ slug: event.target.value });
              if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
            }}
            placeholder="tech-news"
            maxLength={80}
          />
        </Field>

        <Field label="描述" htmlFor="category-description">
          <Textarea
            id="category-description"
            rows={2}
            value={form.description}
            onChange={(event) => updateForm({ description: event.target.value })}
            placeholder="栏目简介，用于门户栏目页描述"
            maxLength={500}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="状态" htmlFor="category-status">
            <Select
              id="category-status"
              value={form.status}
              onChange={(event) => updateForm({ status: event.target.value as EntityStatus })}
            >
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
          <Field label="图标" htmlFor="category-icon" hint="lucide 图标名，如 Folder、BookOpen">
            <Input
              id="category-icon"
              value={form.icon}
              onChange={(event) => updateForm({ icon: event.target.value })}
              placeholder="Folder"
              maxLength={200}
            />
          </Field>
        </div>

        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            SEO 设置
          </p>
          <Field label="SEO 标题" htmlFor="category-seo-title">
            <Input
              id="category-seo-title"
              value={form.seoTitle}
              onChange={(event) => updateForm({ seoTitle: event.target.value })}
              placeholder="默认使用栏目名称"
              maxLength={200}
            />
          </Field>
          <Field label="SEO 关键词" hint="多个关键词用英文逗号分隔" htmlFor="category-seo-keywords">
            <Input
              id="category-seo-keywords"
              value={form.seoKeywords}
              onChange={(event) => updateForm({ seoKeywords: event.target.value })}
              maxLength={500}
            />
          </Field>
          <Field label="SEO 描述" htmlFor="category-seo-description">
            <Textarea
              id="category-seo-description"
              rows={2}
              value={form.seoDescription}
              onChange={(event) => updateForm({ seoDescription: event.target.value })}
              maxLength={500}
            />
          </Field>
        </div>

        {form.type === 'page' ? (
          <Field
            label="页面正文"
            hint="page 类型栏目会作为独立页面渲染，支持 HTML"
            htmlFor="category-content"
          >
            <Textarea
              id="category-content"
              rows={6}
              value={form.content}
              onChange={(event) => updateForm({ content: event.target.value })}
              placeholder="<p>页面内容…</p>"
            />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
