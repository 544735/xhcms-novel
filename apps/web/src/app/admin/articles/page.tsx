'use client';

import {
  ARTICLE_STATUS_LABELS,
  type ArticleBatchAction,
  type ArticleListItem,
  type ArticleStatus,
} from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Send, ShieldAlert, Trash2, Undo2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { ArticlePreviewDialog } from '@/components/admin/article/article-preview-dialog';
import { ArticleTable } from '@/components/admin/article/article-table';
import { errorText, filterCategoryTreeByType, flattenCategoryTree } from '@/components/admin/article/article-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { toast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

const BATCH_SUCCESS: Record<ArticleBatchAction, (count: number) => string> = {
  publish: (count) => `已发布 ${count} 篇文章`,
  unpublish: (count) => `已撤回 ${count} 篇文章`,
  archive: (count) => `已归档 ${count} 篇文章`,
  delete: (count) => `已删除 ${count} 篇文章`,
  top: (count) => `已置顶 ${count} 篇文章`,
  untop: (count) => `已取消置顶 ${count} 篇文章`,
  recommend: (count) => `已推荐 ${count} 篇文章`,
  unrecommend: (count) => `已取消推荐 ${count} 篇文章`,
};

export default function ArticlesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canView = hasPermission('article:view');
  const canCreate = hasPermission('article:create');
  const canUpdate = hasPermission('article:update');
  const canDelete = hasPermission('article:delete');
  const canPublish = hasPermission('article:publish');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 350);
  const [statusFilter, setStatusFilter] = React.useState<ArticleStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [previewArticle, setPreviewArticle] = React.useState<ArticleListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ArticleListItem | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, statusFilter, categoryFilter]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, debouncedKeyword, statusFilter, categoryFilter]);

  const articlesQuery = useQuery({
    queryKey: [
      'articles',
      currentSiteId,
      page,
      pageSize,
      debouncedKeyword,
      statusFilter,
      categoryFilter,
    ],
    queryFn: () =>
      api.articles.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        sortBy: 'createdAt',
        order: 'desc',
      }),
    enabled: canView,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'tree', currentSiteId],
    queryFn: () => api.categories.tree(),
    enabled: canView,
  });

  const categoryOptions = React.useMemo(
    () => flattenCategoryTree(filterCategoryTreeByType(categoriesQuery.data ?? [], 'article')),
    [categoriesQuery.data],
  );

  const items = articlesQuery.data?.items ?? [];
  const total = articlesQuery.data?.total ?? 0;
  const errorMessage =
    articlesQuery.error instanceof ApiError
      ? articlesQuery.error.message
      : articlesQuery.isError
        ? '文章列表加载失败，请稍后重试'
        : null;

  const batchMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: ArticleBatchAction }) =>
      api.articles.batch(ids, action),
    onSuccess: async (result, variables) => {
      toast.success(BATCH_SUCCESS[variables.action](result.affected));
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => {
      setBatchDeleteOpen(false);
      toast.error('批量操作失败', { description: errorText(error) });
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({
      article,
      flag,
    }: {
      article: ArticleListItem;
      flag: 'isTop' | 'isRecommend';
    }) =>
      api.articles.update(
        article.id,
        flag === 'isTop' ? { isTop: !article.isTop } : { isRecommend: !article.isRecommend },
      ),
    onSuccess: async (_result, variables) => {
      const next = variables.flag === 'isTop' ? !variables.article.isTop : !variables.article.isRecommend;
      toast.success(
        variables.flag === 'isTop'
          ? next
            ? '已置顶'
            : '已取消置顶'
          : next
            ? '已推荐'
            : '已取消推荐',
      );
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => toast.error('操作失败', { description: errorText(error) }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ article }: { article: ArticleListItem }) =>
      article.status === 'published'
        ? api.articles.unpublish(article.id)
        : api.articles.publish(article.id),
    onSuccess: async (_result, variables) => {
      toast.success(variables.article.status === 'published' ? '已撤回发布' : '已发布');
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => toast.error('操作失败', { description: errorText(error) }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.articles.remove(id),
    onSuccess: async () => {
      toast.success('文章已删除');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => {
      setDeleteTarget(null);
      toast.error('删除失败', { description: errorText(error) });
    },
  });

  const busyId = flagMutation.isPending
    ? (flagMutation.variables?.article.id ?? null)
    : publishMutation.isPending
      ? (publishMutation.variables?.article.id ?? null)
      : removeMutation.isPending
        ? (removeMutation.variables ?? null)
        : null;

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const hasFilters = Boolean(keyword.trim() || statusFilter || categoryFilter);

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

  const runBatch = (action: ArticleBatchAction) => {
    if (!selectedIds.size) return;
    batchMutation.mutate({ ids: Array.from(selectedIds), action });
  };

  const resetFilters = () => {
    setKeyword('');
    setStatusFilter('');
    setCategoryFilter('');
  };

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader title="文章管理" description="管理站点下的全部内容。" />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="没有访问权限"
            description="当前账号没有查看文章的权限，请联系超级管理员分配。"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="文章管理"
        description="搜索、筛选、批量处理站点文章，并快速切换置顶与推荐。"
        actions={
          canCreate ? (
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => router.push('/admin/articles/new')}
            >
              新建文章
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索标题、摘要…"
            className="w-full sm:w-64"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ArticleStatus | '')}
            aria-label="按状态筛选"
            className="w-full sm:w-36"
          >
            <option value="">全部状态</option>
            {(Object.keys(ARTICLE_STATUS_LABELS) as ArticleStatus[]).map((status) => (
              <option key={status} value={status}>
                {ARTICLE_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="按栏目筛选"
            className="w-full sm:w-44"
          >
            <option value="">全部栏目</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {`${category.depth > 0 ? '— '.repeat(category.depth) : ''}${category.name}`}
              </option>
            ))}
          </Select>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={resetFilters}
            >
              重置
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground sm:ml-auto">共 {total} 篇文章</span>
        </CardContent>
      </Card>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            已选择 {selectedIds.size} 篇文章
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canPublish ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Send className="h-3.5 w-3.5" />}
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('publish')}
                >
                  批量发布
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Undo2 className="h-3.5 w-3.5" />}
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('unpublish')}
                >
                  批量撤回
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button
                size="sm"
                variant="destructive"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                disabled={batchMutation.isPending}
                onClick={() => setBatchDeleteOpen(true)}
              >
                批量删除
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => setSelectedIds(new Set())}
            >
              取消选择
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <ArticleTable
          items={items}
          isLoading={articlesQuery.isLoading}
          errorMessage={errorMessage}
          onRetry={() => void articlesQuery.refetch()}
          selectedIds={selectedIds}
          allSelected={allSelected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          canUpdate={canUpdate}
          canPublish={canPublish}
          canDelete={canDelete}
          busyId={busyId}
          onToggleFlag={(article, flag) => flagMutation.mutate({ article, flag })}
          onEdit={(article) => router.push(`/admin/articles/${article.id}/edit`)}
          onPreview={(article) => setPreviewArticle(article)}
          onTogglePublish={(article) => publishMutation.mutate({ article })}
          onDelete={(article) => setDeleteTarget(article)}
          onCreate={() => router.push('/admin/articles/new')}
          onClearFilters={resetFilters}
          hasFilters={hasFilters}
        />
        {!articlesQuery.isLoading && !errorMessage && total > 0 ? (
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

      <ArticlePreviewDialog
        articleId={previewArticle?.id ?? null}
        open={Boolean(previewArticle)}
        onOpenChange={(open) => {
          if (!open) setPreviewArticle(null);
        }}
        fallbackTitle={previewArticle?.title}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除文章"
        description={deleteTarget ? `确定删除《${deleteTarget.title}》吗？该操作不可撤销。` : undefined}
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
        title="批量删除文章"
        description={`确定删除已选中的 ${selectedIds.size} 篇文章吗？该操作不可撤销。`}
        confirmText="全部删除"
        loading={batchMutation.isPending}
        onConfirm={async () => {
          try {
            await batchMutation.mutateAsync({
              ids: Array.from(selectedIds),
              action: 'delete',
            });
          } catch {
            /* 错误提示已在 onError 中处理 */
          }
        }}
      />
    </div>
  );
}
