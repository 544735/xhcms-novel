'use client';

import type { BookSource } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { collectApi, novelsApi } from '@/lib/api';
import { errorText } from '@/components/admin/novel/novel-utils';

export interface CollectRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: BookSource | null;
  /** 任务创建成功后的回调（例如切换到任务列表并刷新） */
  onCreated?: () => void;
}

/** 正式采集：新建书籍或向已有书籍追加章节 */
export function CollectRunDialog({ open, onOpenChange, source, onCreated }: CollectRunDialogProps) {
  const queryClient = useQueryClient();
  const [bookUrl, setBookUrl] = React.useState('');
  const [novelId, setNovelId] = React.useState('');
  const [limit, setLimit] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setBookUrl('');
    setNovelId('');
    setLimit('');
  }, [open, source]);

  const novelsQuery = useQuery({
    queryKey: ['novels', 'collect-options'],
    queryFn: () => novelsApi.list({ page: 1, pageSize: 100, sortBy: 'updatedAt', order: 'desc' }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      collectApi.run({
        sourceId: source!.id,
        bookUrl: bookUrl.trim() || undefined,
        novelId: novelId || undefined,
        limit: limit.trim() ? Number(limit) : undefined,
      }),
    onSuccess: async (task) => {
      toast.success('采集任务已创建', {
        description: `任务 #${task.id.slice(-6)} 已进入队列，可在任务列表查看进度。`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['collect-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['novels'] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
      onOpenChange(false);
      onCreated?.();
    },
    onError: (error) => toast.error('采集失败', { description: errorText(error) }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="开始采集"
      description={source ? `书源：${source.name}` : undefined}
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button
            size="sm"
            icon={<Play className="h-4 w-4" />}
            loading={mutation.isPending}
            disabled={!source}
            onClick={() => mutation.mutate()}
          >
            创建采集任务
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="书籍页 URL"
          hint="留空使用书源 baseUrl；单本采集建议填写具体书籍地址"
          htmlFor="collect-run-url"
        >
          <Input
            id="collect-run-url"
            value={bookUrl}
            placeholder="https://example.com/book/123"
            onChange={(event) => setBookUrl(event.target.value)}
          />
        </Field>

        <Field
          label="目标书籍"
          hint="选择已有书籍则追加章节；留空将自动新建书籍"
          htmlFor="collect-run-novel"
        >
          <Select
            id="collect-run-novel"
            value={novelId}
            onChange={(event) => setNovelId(event.target.value)}
          >
            <option value="">新建书籍</option>
            {(novelsQuery.data?.items ?? []).map((novel) => (
              <option key={novel.id} value={novel.id}>
                《{novel.title}》· {novel.authorName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="最多采集章节数" hint="留空表示采集全部章节" htmlFor="collect-run-limit">
          <Input
            id="collect-run-limit"
            type="number"
            min={1}
            value={limit}
            placeholder="如：50"
            onChange={(event) => setLimit(event.target.value)}
          />
        </Field>

        <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          采集会按书源规则抓取章节，自动去重并限速（每章间隔 ≥300ms）；失败项会计入任务失败数并记录原因。
        </p>
      </div>
    </Dialog>
  );
}
