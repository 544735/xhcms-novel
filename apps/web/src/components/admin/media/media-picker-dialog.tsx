'use client';

import type { Media } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { CardSkeletonGrid } from '@/components/ui/skeleton';
import { ApiError, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { MediaGrid } from './media-grid';
import { MediaUploader } from './media-uploader';
import { resolveMediaUrl } from './media-utils';

export interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  title?: string;
}

/** 媒体选择器：文章封面等场景复用，选中后回填绝对 URL */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = '从媒体库选择',
}: MediaPickerDialogProps) {
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);

  React.useEffect(() => {
    if (!open) setKeyword('');
  }, [open]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['media', 'picker', currentSiteId, debouncedKeyword],
    queryFn: () =>
      api.media.list({
        page: 1,
        pageSize: 60,
        keyword: debouncedKeyword || undefined,
      }),
    enabled: open,
  });

  const items = data?.items ?? [];
  const errorMessage = error instanceof ApiError ? error.message : '加载媒体库失败';

  const handlePick = (media: Media) => {
    onSelect(resolveMediaUrl(media.url));
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="从媒体库中选择图片，或直接上传新文件"
      size="xl"
      footer={
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          取消
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索文件名…"
            className="sm:flex-1"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            共 {data?.total ?? 0} 个文件
          </span>
        </div>

        <MediaUploader siteId={currentSiteId} compact onUploaded={() => void refetch()} />

        {isLoading ? (
          <CardSkeletonGrid count={6} />
        ) : isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="媒体库加载失败"
            description={errorMessage}
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                重试
              </Button>
            }
          />
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MediaGrid items={items} onPick={handlePick} />
          </div>
        ) : (
          <EmptyState
            title="暂无媒体文件"
            description="上传图片后即可在此选择作为封面或正文配图。"
          />
        )}
      </div>
    </Dialog>
  );
}
