'use client';

import { CHAPTER_DEFAULT_PRICE, type ChapterStatus, type ChapterSummary, type NovelVolume } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { chaptersApi } from '@/lib/api';
import { countWords, errorText } from './novel-utils';

export interface ChapterEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  volumes: NovelVolume[];
  /** 为空表示新建章节 */
  chapter: ChapterSummary | null;
}

/** 章节编辑器（列表只返回摘要，编辑时实时拉取完整正文） */
export function ChapterEditorDialog({
  open,
  onOpenChange,
  novelId,
  volumes,
  chapter,
}: ChapterEditorDialogProps) {
  const detailQuery = useQuery({
    queryKey: ['chapter-detail', chapter?.id, novelId],
    queryFn: () => chaptersApi.get(chapter!.id),
    enabled: open && Boolean(chapter),
    staleTime: 0,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={chapter ? '编辑章节' : '新建章节'}
      description={chapter ? `第 ${chapter.chapterNo} 章` : '新章节的章节号将自动排在最后'}
      size="xl"
    >
      {chapter && detailQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : chapter && detailQuery.isError ? (
        <div className="space-y-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">{errorText(detailQuery.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void detailQuery.refetch()}>
            重新加载
          </Button>
        </div>
      ) : (
        <ChapterForm
          key={chapter?.id ?? 'new'}
          novelId={novelId}
          volumes={volumes}
          chapter={chapter}
          initialContent={chapter ? (detailQuery.data?.content ?? '') : ''}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

interface ChapterFormProps {
  novelId: string;
  volumes: NovelVolume[];
  chapter: ChapterSummary | null;
  initialContent: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function ChapterForm({
  novelId,
  volumes,
  chapter,
  initialContent,
  onSuccess,
  onCancel,
}: ChapterFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState(chapter?.title ?? '');
  const [volumeId, setVolumeId] = React.useState(chapter?.volumeId ?? '');
  const [content, setContent] = React.useState(initialContent);
  const [isVip, setIsVip] = React.useState(chapter?.isVip ?? false);
  const [price, setPrice] = React.useState(String(chapter?.price || CHAPTER_DEFAULT_PRICE));
  const [status, setStatus] = React.useState<ChapterStatus>(chapter?.status ?? 'draft');
  const [error, setError] = React.useState<string | null>(null);

  const words = React.useMemo(() => countWords(content), [content]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        content,
        volumeId: volumeId || null,
        isVip,
        price: isVip ? Math.max(1, Number(price) || CHAPTER_DEFAULT_PRICE) : 0,
        status,
      };
      return chapter ? chaptersApi.update(chapter.id, payload) : chaptersApi.create({ ...payload, novelId });
    },
    onSuccess: async () => {
      toast.success(chapter ? '章节已保存' : '章节已创建');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel-volumes', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
      onSuccess();
    },
    onError: (error) => toast.error('保存失败', { description: errorText(error) }),
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('请输入章节标题');
      return;
    }
    if (!content.trim()) {
      setError('章节正文不能为空');
      return;
    }
    if (isVip && Number(price) < 1) {
      setError('VIP 章节定价至少为 1 书币');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="章节标题" required htmlFor="chapter-title">
          <Input
            id="chapter-title"
            value={title}
            maxLength={200}
            placeholder="如：第一章 星海来客"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="所属分卷" htmlFor="chapter-volume">
          <Select id="chapter-volume" value={volumeId} onChange={(event) => setVolumeId(event.target.value)}>
            <option value="">未分卷</option>
            {volumes.map((volume) => (
              <option key={volume.id} value={volume.id}>
                {volume.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="正文"
        hint="纯文本正文；系统会自动计算字数并统计到书籍总字数"
        htmlFor="chapter-content"
      >
        <Textarea
          id="chapter-content"
          rows={18}
          value={content}
          placeholder="粘贴或输入章节正文…"
          onChange={(event) => setContent(event.target.value)}
          className="font-mono text-[13px] leading-6"
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>字数（估算）：{words}</span>
        <span>系统会按中文/英文规则重新精确统计</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="发布状态" htmlFor="chapter-status">
          <Select
            id="chapter-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ChapterStatus)}
          >
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </Select>
        </Field>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">VIP 章节</p>
          <div className="flex h-9.5 items-center">
            <Switch checked={isVip} onCheckedChange={setIsVip} aria-label="VIP 章节" />
            <span className="ml-2 text-xs text-muted-foreground">{isVip ? '需付费阅读' : '免费章节'}</span>
          </div>
        </div>
        <Field label="价格（书币）" htmlFor="chapter-price">
          <Input
            id="chapter-price"
            type="number"
            min={1}
            step={1}
            value={price}
            disabled={!isVip}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={mutation.isPending}>
          取消
        </Button>
        <Button size="sm" loading={mutation.isPending} onClick={handleSubmit}>
          {chapter ? '保存章节' : '创建章节'}
        </Button>
      </div>
    </div>
  );
}
