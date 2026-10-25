'use client';

import type { Category } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderTree, Plus, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { NovelCategoryDialog } from '@/components/admin/novel/novel-category-dialog';
import {
  collectCategoryBranchIds,
  errorText,
  flattenCategoryRows,
} from '@/components/admin/novel/novel-utils';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { ApiError, categoriesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

export default function NovelCategoriesPage() {
  return (
    <PermissionGate permission="category:view">
      <NovelCategoriesContent />
    </PermissionGate>
  );
}

interface DialogState {
  open: boolean;
  category: Category | null;
  parentId: string | null;
}

const CLOSED_DIALOG: DialogState = { open: false, category: null, parentId: null };

function NovelCategoriesContent() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canCreate = hasPermission('category:create');
  const canUpdate = hasPermission('category:update');
  const canDelete = hasPermission('category:delete');

  const [dialogState, setDialogState] = React.useState<DialogState>(CLOSED_DIALOG);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['novel-categories', currentSiteId],
    queryFn: () => categoriesApi.list({ type: 'novel' }),
  });

  const list = categoriesQuery.data ?? [];
  const rows = React.useMemo(() => flattenCategoryRows(list), [list]);
  const totalBooks = React.useMemo(
    () => list.reduce((sum, category) => sum + category.articleCount, 0),
    [list],
  );

  const parentOptions = React.useMemo(() => {
    const allOptions = rows.map((row) => ({
      id: row.category.id,
      name: row.category.name,
      depth: row.depth,
    }));
    if (!dialogState.category) return allOptions;
    const excluded = collectCategoryBranchIds(list, dialogState.category.id);
    return allOptions.filter((option) => !excluded.has(option.id));
  }, [rows, list, dialogState.category]);

  const removeMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: async () => {
      toast.success('分类已删除');
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['novel-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['novels'] }),
      ]);
    },
    onError: (error) => toast.error('删除分类失败', { description: errorText(error) }),
  });

  const errorMessage =
    categoriesQuery.error instanceof ApiError
      ? categoriesQuery.error.message
      : categoriesQuery.isError
        ? '分类加载失败，请稍后重试'
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="分类管理"
        description="小说分类用于门户书库筛选；列表中「书籍数」表示该分类下的作品数量。"
        actions={
          canCreate ? (
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setDialogState({ open: true, category: null, parentId: null })}
            >
              新建分类
            </Button>
          ) : null
        }
      />

      {!categoriesQuery.isLoading && !errorMessage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">共 {list.length} 个分类</Badge>
          <Badge variant="default">{totalBooks} 本书</Badge>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {categoriesQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : errorMessage ? (
          <EmptyState
            icon={TriangleAlert}
            title="分类加载失败"
            description={errorMessage}
            action={
              <Button variant="outline" size="sm" onClick={() => void categoriesQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : !rows.length ? (
          <EmptyState
            icon={FolderTree}
            title="暂无分类"
            description="创建分类后，作者与管理员即可为书籍归类。"
            action={
              canCreate ? (
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setDialogState({ open: true, category: null, parentId: null })}
                >
                  新建分类
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            {rows.map(({ category, depth }) => {
              const actions: RowActionItem[] = [];
              if (canCreate) {
                actions.push({
                  label: '添加子分类',
                  icon: <Plus className="h-3.5 w-3.5" />,
                  onSelect: () => setDialogState({ open: true, category: null, parentId: category.id }),
                });
              }
              actions.push({
                label: '编辑',
                disabled: !canUpdate,
                onSelect: () => setDialogState({ open: true, category, parentId: null }),
              });
              if (canDelete) {
                actions.push({
                  label: '删除',
                  danger: true,
                  separatorBefore: true,
                  onSelect: () => setDeleteTarget(category),
                });
              }
              return (
                <div
                  key={category.id}
                  className="flex flex-col gap-2 border-b border-border/60 py-3 pr-3 transition-colors last:border-b-0 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  style={{ paddingLeft: 12 + Math.min(depth, 5) * 18 }}
                >
                  <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:mt-0">
                      <FolderTree className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
                        <Badge variant={category.status === 'enabled' ? 'success' : 'outline'} dot>
                          {category.status === 'enabled' ? '启用' : '停用'}
                        </Badge>
                        {category.icon ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {category.icon}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        /{category.slug} · {category.articleCount} 本书 · 排序 {category.sort}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
                    {canCreate ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={() =>
                          setDialogState({ open: true, category: null, parentId: category.id })
                        }
                      >
                        子分类
                      </Button>
                    ) : null}
                    <RowActions items={actions} label="分类操作" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {dialogState.open ? (
        <NovelCategoryDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogState(CLOSED_DIALOG);
          }}
          category={dialogState.category}
          parentOptions={parentOptions}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除分类"
        description={
          deleteTarget
            ? `确定删除「${deleteTarget.name}」吗？若分类下存在子分类或书籍，后端会拒绝删除并提示原因。`
            : undefined
        }
        confirmText="删除"
        loading={removeMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await removeMutation.mutateAsync(deleteTarget.id);
          } catch {
            /* onError 已提示 */
          }
        }}
      />
    </div>
  );
}
