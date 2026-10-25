'use client';

import type { BookSource, CollectTask, CollectTaskStatus } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownload, FlaskConical, Play, Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { BookSourceDialog } from '@/components/admin/collect/book-source-dialog';
import { CollectRunDialog } from '@/components/admin/collect/collect-run-dialog';
import { CollectTestDialog } from '@/components/admin/collect/collect-test-dialog';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import { CollectStatusBadge } from '@/components/admin/novel/novel-badges';
import { COLLECT_STATUS_LABELS, errorText } from '@/components/admin/novel/novel-utils';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { ApiError, collectApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

export default function CollectPage() {
  return (
    <PermissionGate permission="collect:view">
      <CollectContent />
    </PermissionGate>
  );
}

function CollectContent() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const canCreate = hasPermission('collect:create');
  const canUpdate = hasPermission('collect:update');
  const canDelete = hasPermission('collect:delete');
  const canRun = hasPermission('collect:run');

  const [tab, setTab] = React.useState('sources');
  const [sourceDialog, setSourceDialog] = React.useState<{ open: boolean; source: BookSource | null }>({
    open: false,
    source: null,
  });
  const [testTarget, setTestTarget] = React.useState<BookSource | null>(null);
  const [runTarget, setRunTarget] = React.useState<BookSource | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BookSource | null>(null);

  const [taskPage, setTaskPage] = React.useState(1);
  const [taskPageSize, setTaskPageSize] = React.useState(20);
  const [taskStatus, setTaskStatus] = React.useState<CollectTaskStatus | ''>('');

  const sourcesQuery = useQuery({
    queryKey: ['book-sources', currentSiteId],
    queryFn: () => collectApi.sources(),
  });

  const tasksQuery = useQuery({
    queryKey: ['collect-tasks', currentSiteId, taskPage, taskPageSize, taskStatus],
    queryFn: () =>
      collectApi.tasks({
        page: taskPage,
        pageSize: taskPageSize,
        status: taskStatus || undefined,
      }),
    refetchInterval: tab === 'tasks' ? 5000 : false,
  });

  const sources = sourcesQuery.data ?? [];
  const tasks = (tasksQuery.data?.items ?? []) as CollectTask[];
  const taskTotal = tasksQuery.data?.total ?? 0;

  const sourcesError =
    sourcesQuery.error instanceof ApiError
      ? sourcesQuery.error.message
      : sourcesQuery.isError
        ? '书源加载失败，请稍后重试'
        : null;
  const tasksError =
    tasksQuery.error instanceof ApiError
      ? tasksQuery.error.message
      : tasksQuery.isError
        ? '采集任务加载失败，请稍后重试'
        : null;

  const removeMutation = useMutation({
    mutationFn: (id: string) => collectApi.removeSource(id),
    onSuccess: async () => {
      toast.success('书源已删除');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['book-sources'] });
    },
    onError: (error) => toast.error('删除书源失败', { description: errorText(error) }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="采集中心"
        description="维护书源抓取规则，先试采集验证，再创建正式采集任务并跟踪执行结果。"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => {
                if (tab === 'sources') void sourcesQuery.refetch();
                else void tasksQuery.refetch();
              }}
            >
              刷新
            </Button>
            {canCreate ? (
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setSourceDialog({ open: true, source: null })}
              >
                新建书源
              </Button>
            ) : null}
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sources">书源管理</TabsTrigger>
          <TabsTrigger value="tasks">采集任务</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-5">
          <Card className="overflow-hidden">
            {sourcesQuery.isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : sourcesError ? (
              <EmptyState
                icon={TriangleAlert}
                title="书源加载失败"
                description={sourcesError}
                action={
                  <Button variant="outline" size="sm" onClick={() => void sourcesQuery.refetch()}>
                    重新加载
                  </Button>
                }
              />
            ) : !sources.length ? (
              <EmptyState
                icon={CloudDownload}
                title="暂无书源"
                description="创建书源并配置选择器后，即可开始采集小说。"
                action={
                  canCreate ? (
                    <Button
                      size="sm"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => setSourceDialog({ open: true, source: null })}
                    >
                      新建书源
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">书源</TableHead>
                    <TableHead className="w-20">类型</TableHead>
                    <TableHead className="min-w-[200px]">站点地址</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                    <TableHead className="w-40">最近运行</TableHead>
                    <TableHead className="w-16 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => {
                    const actions: RowActionItem[] = [];
                    if (canRun) {
                      actions.push({
                        label: '试采集',
                        icon: <FlaskConical className="h-3.5 w-3.5" />,
                        onSelect: () => setTestTarget(source),
                      });
                      actions.push({
                        label: '正式采集',
                        icon: <Play className="h-3.5 w-3.5" />,
                        onSelect: () => setRunTarget(source),
                      });
                    }
                    actions.push({
                      label: '编辑',
                      disabled: !canUpdate,
                      separatorBefore: true,
                      onSelect: () => setSourceDialog({ open: true, source }),
                    });
                    if (canDelete) {
                      actions.push({
                        label: '删除',
                        danger: true,
                        separatorBefore: true,
                        onSelect: () => setDeleteTarget(source),
                      });
                    }
                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
                          {source.listUrl ? (
                            <p className="mt-0.5 max-w-[280px] truncate text-[11px] text-muted-foreground">
                              {source.listUrl}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={source.type === 'html' ? 'info' : 'purple'}>
                            {source.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="line-clamp-1 text-xs text-muted-foreground">{source.baseUrl}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={source.enabled ? 'success' : 'outline'} dot>
                            {source.enabled ? '启用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {source.lastRunAt ? formatDateTime(source.lastRunAt) : '从未运行'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions items={actions} label="书源操作" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-5">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Select
                value={taskStatus}
                onChange={(event) => {
                  setTaskStatus(event.target.value as CollectTaskStatus | '');
                  setTaskPage(1);
                }}
                aria-label="任务状态筛选"
                className="w-full sm:w-36"
              >
                <option value="">全部状态</option>
                {(Object.keys(COLLECT_STATUS_LABELS) as CollectTaskStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {COLLECT_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted-foreground sm:ml-auto">
                共 {taskTotal} 个任务 · 进行中任务每 5 秒自动刷新
              </span>
            </CardContent>
          </Card>

          <Card className="mt-4 overflow-hidden">
            {tasksQuery.isLoading ? (
              <TableSkeleton rows={5} cols={7} />
            ) : tasksError ? (
              <EmptyState
                icon={TriangleAlert}
                title="采集任务加载失败"
                description={tasksError}
                action={
                  <Button variant="outline" size="sm" onClick={() => void tasksQuery.refetch()}>
                    重新加载
                  </Button>
                }
              />
            ) : !tasks.length ? (
              <EmptyState
                icon={CloudDownload}
                title={taskStatus ? '该状态下暂无任务' : '暂无采集任务'}
                description="在书源列表中点击「正式采集」创建任务。"
              />
            ) : (
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">状态</TableHead>
                    <TableHead className="min-w-[160px]">书源</TableHead>
                    <TableHead className="w-24">模式</TableHead>
                    <TableHead className="min-w-[160px]">目标书籍</TableHead>
                    <TableHead className="w-36">进度</TableHead>
                    <TableHead className="w-36">开始时间</TableHead>
                    <TableHead className="min-w-[200px]">消息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <CollectStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-foreground/90">
                          {task.sourceName ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {task.mode === 'book' ? '新建书籍' : '追加章节'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-foreground/90">
                          {task.novelTitle ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {task.succeeded}/{task.total}
                        </span>
                        {task.failed > 0 ? (
                          <Badge variant="destructive" className="ml-1.5">
                            失败 {task.failed}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {task.startedAt ? formatDateTime(task.startedAt) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-2 max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
                          {task.message ?? '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!tasksQuery.isLoading && !tasksError && taskTotal > 0 ? (
              <div className="border-t border-border/70 px-4">
                <Pagination
                  page={taskPage}
                  pageSize={taskPageSize}
                  total={taskTotal}
                  onPageChange={setTaskPage}
                  onPageSizeChange={(size) => {
                    setTaskPageSize(size);
                    setTaskPage(1);
                  }}
                />
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      {sourceDialog.open ? (
        <BookSourceDialog
          open
          onOpenChange={(open) => {
            if (!open) setSourceDialog({ open: false, source: null });
          }}
          source={sourceDialog.source}
        />
      ) : null}

      <CollectTestDialog
        open={Boolean(testTarget)}
        onOpenChange={(open) => {
          if (!open) setTestTarget(null);
        }}
        source={testTarget}
      />

      <CollectRunDialog
        open={Boolean(runTarget)}
        onOpenChange={(open) => {
          if (!open) setRunTarget(null);
        }}
        source={runTarget}
        onCreated={() => {
          setTaskPage(1);
          setTab('tasks');
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除书源"
        description={deleteTarget ? `确定删除书源「${deleteTarget.name}」吗？历史采集任务不受影响。` : undefined}
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
