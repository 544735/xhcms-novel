'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, FileClock, RefreshCw } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { useDebouncedValue } from '@/components/ui/search-input';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

const RESOURCE_OPTIONS = [
  'article',
  'category',
  'tag',
  'media',
  'comment',
  'member',
  'form',
  'site',
  'theme',
  'plugin',
  'setting',
  'user',
  'role',
  'auth',
];

function prettyDetail(detail: string | null): string {
  if (!detail) return '（无详情）';
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
}

function AuditLogsContent() {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [userId, setUserId] = React.useState('all');
  const [resource, setResource] = React.useState('all');
  const [action, setAction] = React.useState('');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const debouncedAction = useDebouncedValue(action.trim(), 300);

  React.useEffect(() => {
    setPage(1);
  }, [userId, resource, debouncedAction]);

  const logsQuery = useQuery({
    queryKey: ['audit-logs', 'list', page, pageSize, userId, resource, debouncedAction],
    queryFn: () =>
      api.audit.list({
        page,
        pageSize,
        userId: userId === 'all' ? undefined : userId,
        resource: resource === 'all' ? undefined : resource,
        action: debouncedAction || undefined,
      }),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'audit-filter-options'],
    queryFn: () => api.users.list({ page: 1, pageSize: 100 }),
    enabled: hasPermission('user:view'),
    retry: false,
  });

  const items = logsQuery.data?.items ?? [];

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setUserId('all');
    setResource('all');
    setAction('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="操作日志"
        description="记录后台的写操作，便于问题追溯与合规审计。"
        actions={
          <Button variant="outline" onClick={() => void logsQuery.refetch()} disabled={logsQuery.isFetching}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle>日志列表</CardTitle>
              <CardDescription className="mt-1">共 {logsQuery.data?.total ?? 0} 条记录</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Select
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="w-full sm:w-40"
                aria-label="按操作人筛选"
                disabled={!hasPermission('user:view')}
              >
                <option value="all">全部操作人</option>
                {(usersQuery.data?.items ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nickname ?? user.username}
                  </option>
                ))}
              </Select>
              <Select
                value={resource}
                onChange={(event) => setResource(event.target.value)}
                className="w-full sm:w-32"
                aria-label="按资源筛选"
              >
                <option value="all">全部资源</option>
                {RESOURCE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <Input
                value={action}
                onChange={(event) => setAction(event.target.value)}
                placeholder="动作，如 article.create"
                className="w-full font-mono sm:w-52"
                aria-label="按动作筛选"
              />
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                重置
              </Button>
            </div>
          </div>
        </CardHeader>

        {logsQuery.isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : logsQuery.isError ? (
          <CardContent>
            <QueryErrorState
              title="操作日志加载失败"
              description={
                logsQuery.error instanceof ApiError ? logsQuery.error.message : '无法获取日志数据，请稍后重试。'
              }
              onRetry={() => void logsQuery.refetch()}
            />
          </CardContent>
        ) : !items.length ? (
          <CardContent>
            <EmptyState
              icon={FileClock}
              title="暂无操作日志"
              description={
                userId !== 'all' || resource !== 'all' || debouncedAction
                  ? '当前筛选条件下没有日志记录，试着调整或重置筛选。'
                  : '后台写操作发生后，这里会自动记录审计信息。'
              }
            />
          </CardContent>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>资源</TableHead>
                  <TableHead>资源 ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => {
                  const open = expanded.has(log.id);
                  return (
                    <React.Fragment key={log.id}>
                      <TableRow>
                        <TableCell>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(log.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-foreground">{log.username ?? '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="font-mono text-[10px]">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {log.resource}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="block max-w-40 truncate font-mono text-[11px] text-muted-foreground">
                            {log.resourceId ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[11px] text-muted-foreground">{log.ip ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(log.id)}
                            aria-expanded={open}
                          >
                            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {open ? '收起' : '展开'}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
                                <span>
                                  User ID：<span className="font-mono">{log.userId ?? '—'}</span>
                                </span>
                                <span>
                                  UA：<span className="font-mono">{log.userAgent ?? '—'}</span>
                                </span>
                              </div>
                              <pre className="max-h-72 overflow-auto rounded-lg border border-border/70 bg-card p-3 font-mono text-[11px] leading-relaxed text-foreground/85">
                                {prettyDetail(log.detail)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            <div className="border-t border-border/70 px-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={logsQuery.data?.total ?? 0}
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
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <PermissionGate permission="audit:view">
      <AuditLogsContent />
    </PermissionGate>
  );
}
