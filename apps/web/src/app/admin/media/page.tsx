'use client';

import type { Media } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, ImageIcon, ShieldAlert, Trash2, TriangleAlert, X } from 'lucide-react';
import * as React from 'react';
import { MediaGrid } from '@/components/admin/media/media-grid';
import { MediaUploader } from '@/components/admin/media/media-uploader';
import { resolveMediaUrl } from '@/components/admin/media/media-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

export default function MediaPage() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canView = hasPermission('media:view');
  const canUpload = hasPermission('media:upload');
  const canDelete = hasPermission('media:delete');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 350);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<Media | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, debouncedKeyword]);

  const mediaQuery = useQuery({
    queryKey: ['media', currentSiteId, page, pageSize, debouncedKeyword],
    queryFn: () =>
      api.media.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
      }),
    enabled: canView,
  });

  const items = mediaQuery.data?.items ?? [];
  const total = mediaQuery.data?.total ?? 0;
  const errorMessage =
    mediaQuery.error instanceof ApiError
      ? mediaQuery.error.message
      : mediaQuery.isError
        ? '媒体库加载失败，请稍后重试'
        : null;

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.media.remove(id),
    onSuccess: async () => {
      toast.success('媒体文件已删除');
      setDeleteTarget(null);
      setSelectedIds((prev) => new Set());
      if (items.length === 1 && page > 1) setPage((current) => current - 1);
      await queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (error) => {
      toast.error('删除失败', { description: error instanceof ApiError ? error.message : '操作失败' });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.media.batchDelete(ids),
    onSuccess: async (result) => {
      toast.success(`已删除 ${result.affected} 个文件`);
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      if (items.length === selectedIds.size && page > 1) setPage((current) => current - 1);
      await queryClient.invalidateQueries({ queryKey: ['media'] });
    },
    onError: (error) => {
      setBatchDeleteOpen(false);
      toast.error('批量删除失败', {
        description: error instanceof ApiError ? error.message : '操作失败',
      });
    },
  });

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (items.length > 0 && items.every((item) => prev.has(item.id))) return new Set();
      return new Set(items.map((item) => item.id));
    });
  };

  const handleCopy = async (media: Media) => {
    const url = resolveMediaUrl(media.url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('链接已复制', { description: url });
    } catch {
      toast.error('复制失败', { description: `浏览器不允许访问剪贴板，请手动复制：${url}` });
    }
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="媒体库" description="管理站点上传的图片与文件。" />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="没有访问权限"
            description="当前账号没有查看媒体库的权限，请联系超级管理员分配。"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="媒体库"
        description="上传、搜索与复用图片素材；点击「复制链接」可直接用于文章封面或正文。"
      />

      {canUpload ? (
        <Card>
          <CardContent className="p-4">
            <MediaUploader siteId={currentSiteId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索文件名…"
            className="w-full sm:w-64"
          />
          {items.length ? (
            <Button
              variant="outline"
              size="sm"
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              onClick={toggleSelectAll}
            >
              {allSelected ? '取消全选' : '全选本页'}
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground sm:ml-auto">共 {total} 个文件</span>
        </CardContent>
      </Card>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            已选择 {selectedIds.size} 个文件
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => setSelectedIds(new Set())}
            >
              取消选择
            </Button>
            {canDelete ? (
              <Button
                size="sm"
                variant="destructive"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setBatchDeleteOpen(true)}
              >
                批量删除
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {mediaQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      ) : errorMessage ? (
        <Card>
          <EmptyState
            icon={TriangleAlert}
            title="媒体库加载失败"
            description={errorMessage}
            action={
              <Button variant="outline" size="sm" onClick={() => void mediaQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        </Card>
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={ImageIcon}
            title={debouncedKeyword ? '没有匹配的文件' : '媒体库为空'}
            description={
              debouncedKeyword
                ? '尝试更换关键词。'
                : canUpload
                  ? '拖拽或点击上方区域上传图片，作为文章封面与正文素材。'
                  : '当前没有可展示的媒体文件。'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <MediaGrid
              items={items}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onCopy={(media) => void handleCopy(media)}
              onDelete={canDelete ? (media) => setDeleteTarget(media) : undefined}
            />
          </div>
          {total > 0 ? (
            <Card className="px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </Card>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除媒体文件"
        description={
          deleteTarget
            ? `确定删除「${deleteTarget.originalName}」吗？磁盘文件会一并删除。`
            : undefined
        }
        confirmText="删除"
        loading={removeMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await removeMutation.mutateAsync(deleteTarget.id);
          } catch {
            /* 错误提示已在 onError 中处理 */
          }
        }}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="批量删除媒体文件"
        description={`确定删除已选中的 ${selectedIds.size} 个文件吗？该操作不可撤销。`}
        confirmText="全部删除"
        loading={batchDeleteMutation.isPending}
        onConfirm={async () => {
          try {
            await batchDeleteMutation.mutateAsync(Array.from(selectedIds));
          } catch {
            /* 错误提示已在 onError 中处理 */
          }
        }}
      />
    </div>
  );
}
