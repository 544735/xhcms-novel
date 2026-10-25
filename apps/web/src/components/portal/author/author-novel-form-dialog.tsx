'use client';

import type { AuthorNovelItem, NovelInput } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export interface AuthorCategoryOption {
  id: string;
  name: string;
}

interface NovelFormState {
  title: string;
  slug: string;
  categoryId: string;
  cover: string;
  summary: string;
  status: 'serial' | 'completed';
  vipOnly: boolean;
}

const EMPTY_FORM: NovelFormState = {
  title: '',
  slug: '',
  categoryId: '',
  cover: '',
  summary: '',
  status: 'serial',
  vipOnly: false,
};

export interface AuthorNovelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novel: AuthorNovelItem | null;
  penName: string;
  categories: AuthorCategoryOption[];
  saving: boolean;
  onSubmit: (input: NovelInput) => void;
}

/** 作者中心：新建 / 编辑书籍信息 */
export function AuthorNovelFormDialog({
  open,
  onOpenChange,
  novel,
  penName,
  categories,
  saving,
  onSubmit,
}: AuthorNovelFormDialogProps) {
  const [form, setForm] = React.useState<NovelFormState>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (novel) {
      setForm({
        title: novel.title,
        slug: novel.slug,
        categoryId: novel.categoryId ?? '',
        cover: novel.cover ?? '',
        summary: novel.summary ?? '',
        status: novel.status,
        vipOnly: novel.vipOnly,
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setError(null);
  }, [open, novel]);

  const update = <K extends keyof NovelFormState>(key: K, value: NovelFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const title = form.title.trim();
    if (!title) {
      setError('请填写书名');
      return;
    }
    const slug = form.slug.trim();
    if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      setError('书籍标识只能包含小写字母、数字与连字符');
      return;
    }
    setError(null);
    onSubmit({
      title,
      authorName: penName,
      ...(slug ? { slug } : {}),
      categoryId: form.categoryId || null,
      cover: form.cover.trim() || null,
      summary: form.summary.trim() || null,
      status: form.status,
      vipOnly: form.vipOnly,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={novel ? `编辑作品 · ${novel.title}` : '新建作品'}
      description={
        novel
          ? '修改书籍信息不会影响已上架状态；审核状态由管理员控制。'
          : '新建作品默认进入待审核状态，审核通过后才会在书库展示。'
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {novel ? '保存修改' : '创建作品'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="书名" required htmlFor="author-novel-title">
            <Input
              id="author-novel-title"
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="例如：星海拾遗"
              maxLength={120}
              disabled={saving}
            />
          </Field>
          <Field label="书籍标识 slug" hint="用于门户 URL，可留空自动生成" htmlFor="author-novel-slug">
            <Input
              id="author-novel-slug"
              value={form.slug}
              onChange={(event) => update('slug', event.target.value)}
              placeholder="star-sea"
              disabled={saving}
            />
          </Field>
          <Field label="分类" htmlFor="author-novel-category">
            <Select
              id="author-novel-category"
              value={form.categoryId}
              onChange={(event) => update('categoryId', event.target.value)}
              disabled={saving}
            >
              <option value="">未分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="连载状态" htmlFor="author-novel-status">
            <Select
              id="author-novel-status"
              value={form.status}
              onChange={(event) => update('status', event.target.value as NovelFormState['status'])}
              disabled={saving}
            >
              <option value="serial">连载中</option>
              <option value="completed">已完结</option>
            </Select>
          </Field>
          <Field label="封面 URL" hint="留空使用渐变占位封面" htmlFor="author-novel-cover" className="sm:col-span-2">
            <Input
              id="author-novel-cover"
              value={form.cover}
              onChange={(event) => update('cover', event.target.value)}
              placeholder="https://cdn.example.com/cover.jpg"
              maxLength={500}
              disabled={saving}
            />
          </Field>
          <Field label="书籍简介" htmlFor="author-novel-summary" className="sm:col-span-2">
            <Textarea
              id="author-novel-summary"
              rows={4}
              value={form.summary}
              onChange={(event) => update('summary', event.target.value)}
              placeholder="用几句话介绍故事背景与看点…"
              maxLength={2000}
              disabled={saving}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">整本 VIP</p>
            <p className="text-xs text-muted-foreground">开启后所有章节默认按 VIP 章节定价与解锁。</p>
          </div>
          <Switch
            checked={form.vipOnly}
            onCheckedChange={(checked) => update('vipOnly', checked)}
            disabled={saving}
            aria-label="整本 VIP"
          />
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          作者：{penName}（笔名）；作品审核与上架由管理员操作，你可随时编辑书籍信息与章节。
        </p>
      </div>
    </Dialog>
  );
}
