'use client';

import {
  NOVEL_AUDIT_LABELS,
  NOVEL_STATUS_LABELS,
  type NovelAuditStatus,
  type NovelCard,
  type NovelStatus,
} from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { NovelReviewDialog } from '@/components/admin/novel/novel-review-dialog';
import { NovelTable } from '@/components/admin/novel/novel-table';
import { errorText, readSearchParam } from '@/components/admin/novel/novel-utils';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { toast } from '@/components/ui/toast';
import { ApiError, categoriesApi, novelsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

export default function NovelsPage() {
  return (
    <PermissionGate permission="novel:view">
      <NovelsContent />
    </PermissionGate>
  );
}

function NovelsContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canCreate = hasPermission('novel:create');
  const canUpdate = hasPermission('novel:update');
  const canDelete = hasPermission('novel:delete');
  const canReview = hasPermission('novel:review');
  const canViewChapters = hasPermission('chapter:view');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 350);
  const [statusFilter, setStatusFilter] = React.useState<NovelStatus | ''>('');
  const [auditFilter, setAuditFilter] = React.useState<NovelAuditStatus | ''>(
    () => readSearchParam('auditStatus') as NovelAuditStatus | '',
  );
  const [categoryFilter, setCategoryFilter] = React.useState('');
  const [recommendFilter, setRecommendFilter] = React.useState<'' | 'true' | 'false'>('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = React.useState<NovelCard | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<NovelCard | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, statusFilter, auditFilter, categoryFilter, recommendFilter]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, debouncedKeyword, statusFilter, auditFilter, categoryFilter, recommendFilter]);

  const novelsQuery = useQuery({
    queryKey: [
      'novels',
      currentSiteId,
      page,
      pageSize,
      debouncedKeyword,
      statusFilter,
      auditFilter,
      categoryFilter,
      recommendFilter,
    ],
    queryFn: () =>
      novelsApi.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
        status: statusFilter || undefined,
        auditStatus: auditFilter || undefined,
        categoryId: categoryFilter || undefined,
        isRecommend: recommendFilter ? recommendFilter === 'true' : undefined,
        sortBy: 'updatedAt',
        order: 'desc',
      }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['novel-categories', currentSiteId],
    queryFn: () => categoriesApi.list({ type: 'novel' }),
  });

  const items = novelsQuery.data?.items ?? [];
  const total = novelsQuery.data?.total ?? 0;
  const errorMessage =
    novelsQuery.error instanceof ApiError
      ? novelsQuery.error.message
      : novelsQuery.isError
        ? '书籍列表加载失败，请稍后重试'
        : null;

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['novels'] }),
      queryClient.invalidateQueries({ queryKey: ['novel'] }),
      queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
    ]);
  };

  const batchMutation = useMutation({
    mutationFn: ({
      ids,
      action,
    }: {
      ids: string[];
      action: 'publish' | 'offline' | 'recommend' | 'unrecommend' | 'delete';
    }) => novelsApi.batch(ids, action),
    onSuccess: async (result, variables) => {
      const labels: Record<typeof variables.action, string> = {
        publish: '上架',
        offline: '下架',
        recommend: '推荐',
        unrecommend: '取消推荐',
        delete: '删除',
      };
      toast.success(`已${labels[variables.action]} ${result.affected} 本书`);
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      await invalidateAll();
    },
    onError: (error) => {
      setBatchDeleteOpen(false);
      toast.error('批量操作失败', { description: errorText(error) });
    },
  });

  const recommendMutation = useMutation({
    mutationFn: (novel: NovelCard) =>
      novelsApi.update(novel.id, { isRecommend: !novel.isRecommend }),
    onSuccess: async (_data, novel) => {
      toast.success(novel.isRecommend ? '已取消推荐' : '已设为推荐');
      await invalidateAll();
    },
    onError: (error) => toast.error('操作失败', { description: errorText(error) }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => novelsApi.remove(id),
    onSuccess: async () => {
      toast.success('书籍已删除');
      setDeleteTarget(null);
      await invalidateAll();
    },
    onError: (error) => toast.error('删除失败', { description: errorText(error) }),
  });

  const busyId = recommendMutation.isPending
    ? (recommendMutation.variables?.id ?? null)
    : removeMutation.isPending
      ? (removeMutation.variables ?? null)
      : null;

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const hasFilters = Boolean(
    keyword.trim() || statusFilter || auditFilter || categoryFilter || recommendFilter,
  );

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

  const runBatch = (action: 'publish' | 'offline' | 'recommend' | 'unrecommend') => {
    if (!selectedIds.size) return;
    batchMutation.mutate({ ids: Array.from(selectedIds), action });
  };

  const resetFilters = () => {
    setKeyword('');
    setStatusFilter('');
    setAuditFilter('');
    setCategoryFilter('');
    setRecommendFilter('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="书籍管理"
        description="管理小说书籍、审核状态与推荐位，并进入分卷章节维护内容。"
        actions={
          canCreate ? (
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => router.push('/admin/novels/new')}>
              新建书籍
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            placeholder="搜索书名 / 作者…"
            className="w-full sm:w-60"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as NovelStatus | '')}
            aria-label="连载状态筛选"
            className="w-full sm:w-32"
          >
            <option value="">全部连载</option>
            {(Object.keys(NOVEL_STATUS_LABELS) as NovelStatus[]).map((status) => (
              <option key={status} value={status}>
                {NOVEL_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            value={auditFilter}
            onChange={(event) => setAuditFilter(event.target.value as NovelAuditStatus | '')}
            aria-label="审核状态筛选"
            className="w-full sm:w-32"
          >
            <option value="">全部审核</option>
            {(Object.keys(NOVEL_AUDIT_LABELS) as NovelAuditStatus[]).map((status) => (
              <option key={status} value={status}>
                {NOVEL_AUDIT_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="分类筛选"
            className="w-full sm:w-36"
          >
            <option value="">全部分类</option>
            {(categoriesQuery.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            value={recommendFilter}
            onChange={(event) => setRecommendFilter(event.target.value as '' | 'true' | 'false')}
            aria-label="推荐筛选"
            className="w-full sm:w-28"
          >
            <option value="">推荐位</option>
            <option value="true">已推荐</option>
            <option value="false">未推荐</option>
          </Select>
          {hasFilters ? (
            <Button variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetFilters}>
              重置
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground sm:ml-auto">共 {total} 本书</span>
        </CardContent>
      </Card>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">已选择 {selectedIds.size} 本书</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canReview ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('publish')}
                >
                  批量上架
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('offline')}
                >
                  批量下架
                </Button>
              </>
            ) : null}
            {canUpdate ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Star className="h-3.5 w-3.5" />}
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('recommend')}
                >
                  批量推荐
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={batchMutation.isPending}
                  onClick={() => runBatch('unrecommend')}
                >
                  取消推荐
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
        <NovelTable
          items={items}
          isLoading={novelsQuery.isLoading}
          errorMessage={errorMessage}
          onRetry={() => void novelsQuery.refetch()}
          selectedIds={selectedIds}
          allSelected={allSelected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canReview={canReview}
          canViewChapters={canViewChapters}
          busyId={busyId}
          onEdit={(novel) => router.push(`/admin/novels/${novel.id}/edit`)}
          onManageChapters={(novel) => router.push(`/admin/novels/${novel.id}/edit?tab=chapters`)}
          onReview={(novel) => setReviewTarget(novel)}
          onToggleRecommend={(novel) => recommendMutation.mutate(novel)}
          onDelete={(novel) => setDeleteTarget(novel)}
          onCreate={() => router.push('/admin/novels/new')}
          onClearFilters={resetFilters}
          hasFilters={hasFilters}
        />
        {!novelsQuery.isLoading && !errorMessage && total > 0 ? (
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

      <NovelReviewDialog
        novel={reviewTarget}
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除书籍"
        description={
          deleteTarget
            ? `确定删除《${deleteTarget.title}》吗？该操作会级联删除章节、评论、书架与阅读进度，且不可撤销。`
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

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        title="批量删除书籍"
        description={`确定删除已选中的 ${selectedIds.size} 本书吗？会级联删除章节与评论，且不可撤销。`}
        confirmText="全部删除"
        loading={batchMutation.isPending}
        onConfirm={async () => {
          try {
            await batchMutation.mutateAsync({ ids: Array.from(selectedIds), action: 'delete' });
          } catch {
            /* onError 已提示 */
          }
        }}
      />
    </div>
  );
}
