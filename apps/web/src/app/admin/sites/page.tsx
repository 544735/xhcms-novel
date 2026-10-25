'use client';

import type { Site, Theme } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { SiteFormDialog } from '@/components/admin/system/site-form-dialog';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { Select } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { api, ApiError, type SiteInput } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

function SitesContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [keyword, setKeyword] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Site | null>(null);
  const [deleting, setDeleting] = React.useState<Site | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, status]);

  const sitesQuery = useQuery({
    queryKey: ['sites', 'list', page, pageSize, debouncedKeyword, status],
    queryFn: () =>
      api.sites.list({
        page,
        pageSize,
        keyword: debouncedKeyword || undefined,
        status: status === 'all' ? undefined : status,
      }),
  });

  const themesQuery = useQuery({
    queryKey: ['themes', 'list'],
    queryFn: () => api.themes.list(),
  });

  const themes: Theme[] = themesQuery.data ?? [];
  const themeNames = React.useMemo(
    () => new Map(themes.map((theme) => [theme.key, theme.name])),
    [themes],
  );

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SiteInput }) =>
      id ? api.sites.update(id, input) : api.sites.create(input),
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? '站点信息已更新' : '站点创建成功');
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      void queryClient.invalidateQueries({ queryKey: ['themes'] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '保存失败，请稍后重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.sites.remove(id),
    onSuccess: () => {
      toast.success('站点已删除');
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      void queryClient.invalidateQueries({ queryKey: ['themes'] });
      setDeleting(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '删除失败，请稍后重试');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditing(site);
    setDialogOpen(true);
  };

  const items = sitesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="站点管理"
        description="管理平台下的所有站点，配置域名、主题、SEO 与站点状态。"
        actions={
          <>
            <Button variant="outline" onClick={() => void sitesQuery.refetch()} disabled={sitesQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {hasPermission('site:create') ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建站点
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle>站点列表</CardTitle>
            <CardDescription className="mt-1">共 {sitesQuery.data?.total ?? 0} 个站点</CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索站点名称或标识"
              className="w-full sm:w-64"
            />
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full sm:w-32"
              aria-label="按状态筛选"
            >
              <option value="all">全部状态</option>
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </div>
        </CardHeader>

        {sitesQuery.isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : sitesQuery.isError ? (
          <CardContent>
            <QueryErrorState
              title="站点列表加载失败"
              description={
                sitesQuery.error instanceof ApiError ? sitesQuery.error.message : '无法获取站点数据，请稍后重试。'
              }
              onRetry={() => void sitesQuery.refetch()}
            />
          </CardContent>
        ) : !items.length ? (
          <CardContent>
            <EmptyState
              icon={Globe2}
              title={debouncedKeyword || status !== 'all' ? '没有匹配的站点' : '还没有站点'}
              description={
                debouncedKeyword || status !== 'all'
                  ? '尝试调整搜索关键词或状态筛选。'
                  : '创建第一个站点后，即可开始配置栏目、文章与主题。'
              }
              action={
                hasPermission('site:create') ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    新建站点
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>站点</TableHead>
                  <TableHead>域名</TableHead>
                  <TableHead>主题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
                          {site.name.slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{site.name}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">/{site.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{site.domain || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{themeNames.get(site.themeKey) ?? site.themeKey}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={site.status} />
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(site.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dropdown
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={`操作 ${site.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                        items={[
                          {
                            label: '编辑站点',
                            icon: <Pencil className="h-3.5 w-3.5" />,
                            disabled: !hasPermission('site:update'),
                            onSelect: () => openEdit(site),
                          },
                          {
                            label: '删除站点',
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            danger: true,
                            separatorBefore: true,
                            disabled: !hasPermission('site:delete'),
                            onSelect: () => setDeleting(site),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border/70 px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={sitesQuery.data?.total ?? 0}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </Card>

      <SiteFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        site={editing}
        themes={themes}
        saving={saveMutation.isPending}
        onSubmit={(input) => saveMutation.mutate({ id: editing?.id, input })}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="删除站点"
        description={
          deleting
            ? `确定删除站点「${deleting.name}」吗？该操作不可撤销；若站点下仍有内容，接口会拒绝删除。`
            : undefined
        }
        confirmText="删除"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteMutation.mutateAsync(deleting.id);
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />
    </div>
  );
}

export default function SitesPage() {
  return (
    <PermissionGate permission="site:view">
      <SitesContent />
    </PermissionGate>
  );
}
