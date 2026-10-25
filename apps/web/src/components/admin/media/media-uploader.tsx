'use client';

import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES, type Media } from '@wmcms/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CloudUpload } from 'lucide-react';
import * as React from 'react';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface MediaUploaderProps {
  siteId: string | null;
  onUploaded?: (uploaded: Media[]) => void;
  compact?: boolean;
  className?: string;
}

/** 媒体上传区域：支持点击选择与拖拽多文件上传 */
export function MediaUploader({ siteId, onUploaded, compact = false, className }: MediaUploaderProps) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

  const uploading = progress !== null;

  const handleFiles = React.useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (!files.length) return;
      if (!siteId) {
        toast.error('请先选择站点后再上传');
        return;
      }

      const accepted = files.filter((file) => {
        if (file.size > UPLOAD_MAX_BYTES) {
          toast.error(`「${file.name}」超过 10MB 上限`);
          return false;
        }
        return true;
      });
      if (!accepted.length) return;

      setProgress({ done: 0, total: accepted.length });
      const uploaded: Media[] = [];
      let failed = 0;
      let lastError = '';

      for (let index = 0; index < accepted.length; index += 1) {
        try {
          const media = await api.media.upload(accepted[index], siteId);
          uploaded.push(media);
        } catch (error) {
          failed += 1;
          lastError = error instanceof ApiError ? error.message : '上传失败';
        }
        setProgress({ done: index + 1, total: accepted.length });
      }

      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';

      if (uploaded.length) {
        toast.success(`已上传 ${uploaded.length} 个文件`);
        onUploaded?.(uploaded);
        await queryClient.invalidateQueries({ queryKey: ['media'] });
      }
      if (failed) {
        toast.error(`${failed} 个文件上传失败`, { description: lastError });
      }
    },
    [siteId, onUploaded, queryClient],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!uploading && siteId) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!uploading) void handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        'rounded-xl border border-dashed p-4 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-input bg-muted/20',
        !siteId && 'opacity-70',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ALLOWED_MIME.join(',')}
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2',
          compact && 'sm:flex-row sm:gap-3',
        )}
      >
        <CloudUpload className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-6 w-6')} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {uploading
            ? `正在上传 ${progress?.done ?? 0}/${progress?.total ?? 0}…`
            : siteId
              ? '拖拽文件到此处，或'
              : '未选择站点，暂不可上传'}
          {!uploading && siteId ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-1 font-medium text-primary hover:underline"
            >
              点击选择文件
            </button>
          ) : null}
        </p>
      </div>
      {!compact ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          支持 JPG / PNG / WebP / GIF / SVG / PDF，单个文件不超过 10MB
        </p>
      ) : null}
    </div>
  );
}
