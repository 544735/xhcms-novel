'use client';

import type { AuthorNovelItem, ChapterInput, ChapterSummary } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Save, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { countChapterWords, formatWordCount } from '@/components/portal/author/word-count';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { readerApi } from '@/lib/api';

/** 章节编辑器提交体：编辑时可省略 content（表示保留原正文） */
export type ChapterDraftInput = Omit<ChapterInput, 'content'> & { content?: string };

export interface AuthorChapterEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteSlug: string;
  novel: AuthorNovelItem | null;
  /** null 表示新建章节 */
  chapter: ChapterSummary | null;
  saving: boolean;
  onSubmit: (input: ChapterDraftInput) => void;
}

/**
 * 纯文本章节编辑器：标题 + 正文（textarea）+ 实时字数 + VIP 定价 + 状态。
 *
 * 注意：作者章节列表接口只返回摘要（不含正文），因此编辑已发布章节时通过门户阅读接口
 * 拉取正文（作者本人不受 VIP 限制）；草稿章节正文无法回读，需重新粘贴（留空则保留原正文）。
 */
export function AuthorChapterEditorDialog({
  open,
  onOpenChange,
  siteSlug,
  novel,
  chapter,
  saving,
  onSubmit,
}: AuthorChapterEditorDialogProps) {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [isVip, setIsVip] = React.useState(false);
  const [price, setPrice] = React.useState('20');
  const [status, setStatus] = React.useState<'draft' | 'published'>('published');
  const [error, setError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  const canLoadPublished = Boolean(open && novel && chapter && chapter.status === 'published');

  const contentQuery = useQuery({
    queryKey: ['member', 'author', 'chapter-content', novel?.slug, chapter?.chapterNo],
    queryFn: () =>
      readerApi.chapter(siteSlug, novel!.slug, chapter!.chapterNo),
    enabled: canLoadPublished,
    retry: false,
  });

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setHydrated(false);
    setTitle(chapter?.title ?? '');
    setContent('');
    setIsVip(chapter?.isVip ?? false);
    setPrice(String(chapter?.price && chapter.price > 0 ? chapter.price : 20));
    setStatus(chapter?.status ?? 'published');
  }, [open, chapter]);

  React.useEffect(() => {
    if (!open || hydrated) return;
    if (chapter && chapter.status === 'published' && contentQuery.data) {
      setContent(contentQuery.data.content ?? '');
      setHydrated(true);
    }
  }, [open, hydrated, chapter, contentQuery.data]);

  const wordCount = React.useMemo(() => countChapterWords(content), [content]);

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('请填写章节标题');
      return;
    }
    if (!chapter && !content.trim()) {
      setError('请填写章节正文');
      return;
    }
    const parsedPrice = Number(price);
    if (isVip && (!Number.isInteger(parsedPrice) || parsedPrice < 1)) {
      setError('VIP 章节价格需为不小于 1 的整数');
      return;
    }
    setError(null);
    const base = {
      title: title.trim(),
      isVip,
      price: isVip ? Math.max(1, Math.trunc(parsedPrice)) : 0,
      status,
    };
    const trimmedContent = content.trim();
    onSubmit(trimmedContent ? { ...base, content: trimmedContent } : base);
  };

  const loadingContent = canLoadPublished && contentQuery.isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={chapter ? `编辑章节 · 第 ${chapter.chapterNo} 章` : '新建章节'}
      description={novel ? `作品：${novel.title} · 保存后自动重算字数与章节数` : undefined}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit} disabled={loadingContent}>
            <Save className="h-4 w-4" />
            {chapter ? '保存章节' : '创建章节'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="章节标题" required htmlFor="chapter-title" className="sm:col-span-2">
            <Input
              id="chapter-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：第一章 星海来客"
              maxLength={120}
              disabled={saving}
            />
          </Field>
        </div>

        <Field
          label="章节正文（纯文本，支持直接粘贴）"
          required={!chapter}
          hint={
            chapter
              ? '已发布章节会自动加载正文；草稿章节正文接口无法回读，留空则保留原正文。'
              : '后端会自动清洗 HTML 标签与多余空行。'
          }
        >
          {loadingContent ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在加载章节正文…
              </p>
            </div>
          ) : (
            <Textarea
              rows={16}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="粘贴或输入章节正文…"
              className="min-h-[320px] font-serif text-[15px] leading-7"
              disabled={saving}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">
            <FileText className="mr-1 h-3 w-3" />
            实时字数：{formatWordCount(wordCount)}
          </Badge>
          {chapter ? <Badge variant="outline">当前状态：{chapter.status === 'published' ? '已发布' : '草稿'}</Badge> : null}
        </div>

        <div className="grid gap-4 rounded-xl border border-border/70 p-4 sm:grid-cols-3">
          <div className="flex items-center justify-between gap-3 sm:col-span-1">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                VIP 章节
              </p>
              <p className="text-[11px] text-muted-foreground">开启后读者需书币解锁</p>
            </div>
            <Switch
              checked={isVip}
              onCheckedChange={setIsVip}
              disabled={saving}
              aria-label="VIP 章节"
            />
          </div>
          <Field label="解锁定价（书币）" hint={isVip ? '至少 1 书币，默认 20' : '非 VIP 章节不收费'}>
            <Input
              type="number"
              min={1}
              max={100000}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={saving || !isVip}
            />
          </Field>
          <Field label="章节状态" hint={novel?.auditStatus === 'published' ? '书籍已上架，可直接发布' : '书籍未上架时强制保存为草稿'}>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'draft' | 'published')}
              disabled={saving}
            >
              <option value="published">发布</option>
              <option value="draft">草稿</option>
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
