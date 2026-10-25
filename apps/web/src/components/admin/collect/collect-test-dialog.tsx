'use client';

import type { BookSource } from '@wmcms/shared';
import { useMutation } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { collectApi } from '@/lib/api';
import { errorText } from '@/components/admin/novel/novel-utils';

export interface CollectTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: BookSource | null;
}

/** 试采集：只抓取书籍信息与前 5 章标题，不落库 */
export function CollectTestDialog({ open, onOpenChange, source }: CollectTestDialogProps) {
  const [bookUrl, setBookUrl] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setBookUrl('');
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => collectApi.testSource(source!.id, bookUrl.trim() || undefined),
    onError: (error) => toast.error('试采集失败', { description: errorText(error) }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="试采集"
      description={source ? `书源：${source.name}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            size="sm"
            icon={<FlaskConical className="h-4 w-4" />}
            loading={mutation.isPending}
            disabled={!source}
            onClick={() => mutation.mutate()}
          >
            开始试采集
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="书籍页 URL"
          hint="留空则使用书源 baseUrl；建议先填写具体书籍页地址"
          htmlFor="collect-test-url"
        >
          <Input
            id="collect-test-url"
            value={bookUrl}
            placeholder="https://example.com/book/123"
            onChange={(event) => setBookUrl(event.target.value)}
          />
        </Field>

        {mutation.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : mutation.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorText(mutation.error)}
          </div>
        ) : mutation.data ? (
          <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{mutation.data.book.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                作者：{mutation.data.book.author || '—'}
              </p>
              {mutation.data.book.summary ? (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {mutation.data.book.summary}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">
                章节预览（前 {mutation.data.chapters.length} 条）
              </p>
              {mutation.data.chapters.length ? (
                <ul className="mt-2 space-y-1">
                  {mutation.data.chapters.map((chapter, index) => (
                    <li key={`${chapter.title}-${index}`} className="truncate text-xs text-muted-foreground">
                      {index + 1}. {chapter.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">未解析到章节，请检查 selectors 配置。</p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            试采集只抓取书名、作者、封面、简介与前 5 条章节标题，不会写入数据库。
          </p>
        )}
      </div>
    </Dialog>
  );
}
