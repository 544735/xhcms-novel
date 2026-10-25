'use client';

import type { Tag } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import * as React from 'react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { TagDialog } from '@/components/admin/tag/tag-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

export default function TagsPage() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canView = hasPermission('tag:view');
  const canCreate = hasPermission('tag:create');
  const canUpdate = hasPermission('tag:update');
  const canDelete = hasPermission('tag:delete');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 350);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTag, setEditingTag] = React.useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Tag | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword]);

  const tagsQuery = useQuery({
    queryKey: ['tags', currentSiteId, page, pageSize, debouncedKeyword],
    queryFn: () =>
      api.tags.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
      }),
    enabled: canView,
  });

  const items = tagsQuery.data?.items ?? [];
  const total = tagsQuery.data?.total ?? 0;
  const errorMessage =
    tagsQuery.error instanceof ApiError
      ? tagsQuery.error.message
      : tagsQuery.isError
        ? '标签加载失败，请稍后重试'
        : null;

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.tags.remove(id),
    onSuccess: async () => {
      toast.success('标签已删除');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => {
      toast.error('删除标签失败', {
        description: error instanceof ApiError ? error.message : '操作失败，请稍后重试',
      });
    },
  });

  const openCreate = () => {
    setEditingTag(null);
    setDialogOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setDialogOpen(true);
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="标签管理" description="维护文章标签。" />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="没有访问权限"
            description="当前账号没有查看标签的权限，请联系超级管理员分配。"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="标签管理"
        description="标签用于文章归类与门户标签聚合页。"
        actions={
          canCreate ? (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              新建标签
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索标签名称或 slug…"
            className="w-full sm:w-72"
          />
          <span className="text-xs text-muted-foreground sm:ml-auto">共 {total} 个标签</span>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {tagsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : errorMessage ? (
          <EmptyState
            icon={TriangleAlert}
            title="标签加载失败"
            description={errorMessage}
            action={
              <Button variant="outline" size="sm" onClick={() => void tagsQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : !items.length ? (
          <EmptyState
            icon={Bookmark}
            title={debouncedKeyword ? '没有匹配的标签' : '暂无标签'}
            description={
              debouncedKeyword ? '尝试其他关键词。' : '创建标签后即可在文章编辑器中多选使用。'
            }
            action={
              canCreate ? (
                <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  新建标签
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">名称</TableHead>
                <TableHead className="min-w-[160px]">Slug</TableHead>
                <TableHead className="w-28">文章数</TableHead>
                <TableHead className="w-40">创建时间</TableHead>
                <TableHead className="w-16 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((tag) => {
                const actions: RowActionItem[] = [
                  {
                    label: '编辑',
                    icon: <Pencil className="h-3.5 w-3.5" />,
                    disabled: !canUpdate,
                    onSelect: () => openEdit(tag),
                  },
                  {
                    label: '删除',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    danger: true,
                    separatorBefore: true,
                    disabled: !canDelete,
                    onSelect: () => setDeleteTarget(tag),
                  },
                ];
                return (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Bookmark className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate text-sm font-medium text-foreground">{tag.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">/{tag.slug}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tag.articleCount > 0 ? 'default' : 'secondary'}>
                        {tag.articleCount} 篇
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(tag.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions items={actions} label="标签操作" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!tagsQuery.isLoading && !errorMessage && total > 0 ? (
          <div className="border-t border-border/70 px-4">
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
          </div>
        ) : null}
      </Card>

      {dialogOpen ? (
        <TagDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogOpen(false);
          }}
          tag={editingTag}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除标签"
        description={
          deleteTarget
            ? `确定删除标签「${deleteTarget.name}」吗？关联文章的标签引用会同步解除。`
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
    </div>
  );
}
