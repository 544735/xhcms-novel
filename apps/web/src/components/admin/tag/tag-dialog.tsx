'use client';

import type { Tag } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';

export interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function TagDialog({ open, onOpenChange, tag }: TagDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [errors, setErrors] = React.useState<{ name?: string; slug?: string }>({});

  React.useEffect(() => {
    if (!open) return;
    setName(tag?.name ?? '');
    setSlug(tag?.slug ?? '');
    setErrors({});
  }, [open, tag]);

  const mutation = useMutation({
    mutationFn: () =>
      tag
        ? api.tags.update(tag.id, { name: name.trim(), slug: slug.trim() || undefined })
        : api.tags.create({ name: name.trim(), slug: slug.trim() || undefined }),
    onSuccess: async () => {
      toast.success(tag ? '标签已更新' : '标签已创建');
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(tag ? '更新标签失败' : '创建标签失败', {
        description: error instanceof ApiError ? error.message : '操作失败，请稍后重试',
      });
    },
  });

  const handleSubmit = () => {
    const next: { name?: string; slug?: string } = {};
    if (!name.trim()) next.name = '请输入标签名称';
    if (slug.trim() && !SLUG_PATTERN.test(slug.trim())) {
      next.slug = 'slug 只能包含小写字母、数字与连字符';
    }
    setErrors(next);
    if (next.name ?? next.slug) return;
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={tag ? '编辑标签' : '新建标签'}
      description="标签用于门户的标签聚合页，名称需保持简短。"
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
            {tag ? '保存修改' : '创建标签'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="名称" required error={errors.name} htmlFor="tag-name">
          <Input
            id="tag-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="如：前端开发"
            maxLength={40}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
        </Field>
        <Field
          label="Slug"
          error={errors.slug}
          hint="留空自动生成；仅允许小写字母、数字与连字符"
          htmlFor="tag-slug"
        >
          <Input
            id="tag-slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
            }}
            placeholder="frontend"
            maxLength={80}
          />
        </Field>
      </div>
    </Dialog>
  );
}
