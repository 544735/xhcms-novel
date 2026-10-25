'use client';

import type { TxtImportResult } from '@wmcms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { novelsApi } from '@/lib/api';
import { errorText } from './novel-utils';

export interface TxtImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
}

/** TXT 批量导入：自动按正则分章 */
export function TxtImportDialog({ open, onOpenChange, novelId }: TxtImportDialogProps) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [volumeTitle, setVolumeTitle] = React.useState('');
  const [pattern, setPattern] = React.useState('');
  const [result, setResult] = React.useState<TxtImportResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFile(null);
    setVolumeTitle('');
    setPattern('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => novelsApi.importTxt(novelId, file!, volumeTitle.trim() || undefined, pattern.trim() || undefined),
    onSuccess: async (data) => {
      setResult(data);
      toast.success(`导入成功：${data.chapters} 章 / ${data.words} 字`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel-volumes', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel', novelId] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
    },
    onError: (error) => toast.error('导入失败', { description: errorText(error) }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="TXT 批量导入"
      description="上传 TXT 文件，系统按章节标题正则自动分章并清洗空行。"
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            关闭
          </Button>
          <Button
            size="sm"
            icon={<FileUp className="h-4 w-4" />}
            loading={mutation.isPending}
            disabled={!file}
            onClick={() => mutation.mutate()}
          >
            开始导入
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="TXT 文件" required hint="建议 UTF-8 编码，单个文件不超过 20MB">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              icon={<FileUp className="h-3.5 w-3.5" />}
            >
              选择文件
            </Button>
            <span className="truncate text-xs text-muted-foreground">
              {file ? `${file.name}（${(file.size / 1024 / 1024).toFixed(2)} MB）` : '尚未选择文件'}
            </span>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="分卷名称" hint="留空则自动按月份创建分卷" htmlFor="txt-volume-title">
            <Input
              id="txt-volume-title"
              value={volumeTitle}
              maxLength={80}
              placeholder="如：正文卷"
              onChange={(event) => setVolumeTitle(event.target.value)}
            />
          </Field>
          <Field
            label="分章正则"
            hint="默认 ^第[一二三四五六七八九十百千0-9]+[章节回]"
            htmlFor="txt-pattern"
          >
            <Input
              id="txt-pattern"
              value={pattern}
              maxLength={200}
              placeholder="留空使用默认正则"
              onChange={(event) => setPattern(event.target.value)}
            />
          </Field>
        </div>

        {result ? (
          <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-foreground">
            导入完成：新增 <span className="font-semibold">{result.chapters}</span> 章，共计{' '}
            <span className="font-semibold">{result.words}</span> 字。
          </div>
        ) : (
          <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            导入过程会保留章节标题作为章节名；正文中的 HTML 标签与多余空行会被自动清理。
          </p>
        )}
      </div>
    </Dialog>
  );
}
