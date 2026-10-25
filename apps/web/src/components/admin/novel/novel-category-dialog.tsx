'use client';

import type { Category, EntityStatus } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { categoriesApi, type CategoryInput } from '@/lib/api';
import { errorText, isValidSlug } from './novel-utils';

export interface CategoryOptionWithDepth {
  id: string;
  name: string;
  depth: number;
}

interface CategoryFormState {
  parentId: string;
  name: string;
  slug: string;
  sort: string;
  status: EntityStatus;
  icon: string;
  description: string;
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
}

const EMPTY: CategoryFormState = {
  parentId: '',
  name: '',
  slug: '',
  sort: '0',
  status: 'enabled',
  icon: '',
  description: '',
  seoTitle: '',
  seoKeywords: '',
  seoDescription: '',
};

export interface NovelCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  parentOptions: CategoryOptionWithDepth[];
}

/** 小说分类新建/编辑（type 固定 novel） */
export function NovelCategoryDialog({
  open,
  onOpenChange,
  category,
  parentOptions,
}: NovelCategoryDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<CategoryFormState>(EMPTY);
  const [errors, setErrors] = React.useState<{ name?: string; slug?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setForm({
      parentId: category?.parentId ?? '',
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      sort: String(category?.sort ?? 0),
      status: category?.status ?? 'enabled',
      icon: category?.icon ?? '',
      description: category?.description ?? '',
      seoTitle: category?.seoTitle ?? '',
      seoKeywords: category?.seoKeywords ?? '',
      seoDescription: category?.seoDescription ?? '',
    });
    setErrors({});
  }, [open, category]);

  const update = (patch: Partial<CategoryFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const mutation = useMutation({
    mutationFn: (input: CategoryInput) =>
      category ? categoriesApi.update(category.id, input) : categoriesApi.create(input),
    onSuccess: async () => {
      toast.success(category ? '分类已更新' : '分类已创建');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['novel-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['novels'] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => toast.error('保存失败', { description: errorText(error) }),
  });

  const handleSubmit = () => {
    const next: { name?: string; slug?: string } = {};
    if (!form.name.trim()) next.name = '请输入分类名称';
    if (form.slug.trim() && !isValidSlug(form.slug)) {
      next.slug = 'slug 只能包含小写字母、数字与连字符，且不能以连字符开头';
    }
    setErrors(next);
    if (next.name ?? next.slug) return;

    mutation.mutate({
      parentId: form.parentId || null,
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      type: 'novel',
      sort: Number(form.sort) || 0,
      status: form.status,
      icon: form.icon.trim() || null,
      description: form.description.trim() || null,
      seoTitle: form.seoTitle.trim() || null,
      seoKeywords: form.seoKeywords.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? '编辑分类' : '新建分类'}
      description="小说分类用于门户书库筛选；父分类下可继续建子分类。"
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
            {category ? '保存修改' : '创建分类'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="父分类" htmlFor="novel-category-parent" hint="留空为顶级分类">
          <Select
            id="novel-category-parent"
            value={form.parentId}
            onChange={(event) => update({ parentId: event.target.value })}
          >
            <option value="">顶级分类</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {`${option.depth > 0 ? '— '.repeat(option.depth) : ''}${option.name}`}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="名称" required error={errors.name} htmlFor="novel-category-name">
            <Input
              id="novel-category-name"
              value={form.name}
              maxLength={60}
              placeholder="如：玄幻仙侠"
              onChange={(event) => {
                update({ name: event.target.value });
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
          </Field>
          <Field
            label="Slug"
            error={errors.slug}
            hint="留空自动生成"
            htmlFor="novel-category-slug"
          >
            <Input
              id="novel-category-slug"
              value={form.slug}
              maxLength={80}
              placeholder="xuan-huan"
              onChange={(event) => {
                update({ slug: event.target.value });
                if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
              }}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="排序" hint="数字越小越靠前" htmlFor="novel-category-sort">
            <Input
              id="novel-category-sort"
              type="number"
              min={0}
              value={form.sort}
              onChange={(event) => update({ sort: event.target.value })}
            />
          </Field>
          <Field label="状态" htmlFor="novel-category-status">
            <Select
              id="novel-category-status"
              value={form.status}
              onChange={(event) => update({ status: event.target.value as EntityStatus })}
            >
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        </div>

        <Field label="图标" hint="lucide 图标名，如 BookOpen（可选）" htmlFor="novel-category-icon">
          <Input
            id="novel-category-icon"
            value={form.icon}
            maxLength={100}
            placeholder="BookOpen"
            onChange={(event) => update({ icon: event.target.value })}
          />
        </Field>

        <Field label="描述" htmlFor="novel-category-description">
          <Textarea
            id="novel-category-description"
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
            placeholder="分类简介（可选）"
          />
        </Field>

        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            SEO 设置
          </p>
          <Field label="SEO 标题" htmlFor="novel-category-seo-title">
            <Input
              id="novel-category-seo-title"
              value={form.seoTitle}
              maxLength={200}
              onChange={(event) => update({ seoTitle: event.target.value })}
            />
          </Field>
          <Field label="SEO 关键词" hint="多个关键词用英文逗号分隔" htmlFor="novel-category-seo-keywords">
            <Input
              id="novel-category-seo-keywords"
              value={form.seoKeywords}
              maxLength={500}
              onChange={(event) => update({ seoKeywords: event.target.value })}
            />
          </Field>
          <Field label="SEO 描述" htmlFor="novel-category-seo-description">
            <Textarea
              id="novel-category-seo-description"
              rows={2}
              maxLength={500}
              value={form.seoDescription}
              onChange={(event) => update({ seoDescription: event.target.value })}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
