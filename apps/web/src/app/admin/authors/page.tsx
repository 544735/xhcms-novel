'use client';

import type { AuthorStatus } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import { PenTool, ShieldCheck, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import { RowActions, type RowActionItem } from '@/components/admin/article/row-actions';
import {
  AuthorReviewDialog,
  type AuthorApplicationItem,
} from '@/components/admin/author/author-review-dialog';
import { AuthorStatusBadge } from '@/components/admin/novel/novel-badges';
import { AUTHOR_STATUS_LABELS, errorText, readSearchParam } from '@/components/admin/novel/novel-utils';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authorApplicationsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

export default function AuthorsPage() {
  return (
    <PermissionGate permission="author:view">
      <AuthorsContent />
    </PermissionGate>
  );
}

function AuthorsContent() {
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canReview = hasPermission('author:review');

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [statusFilter, setStatusFilter] = React.useState<AuthorStatus | ''>(
    () => readSearchParam('status') as AuthorStatus | '',
  );
  const [reviewTarget, setReviewTarget] = React.useState<AuthorApplicationItem | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const applicationsQuery = useQuery({
    queryKey: ['author-applications', currentSiteId, page, pageSize, statusFilter],
    queryFn: () =>
      authorApplicationsApi.list({
        page,
        pageSize,
        status: statusFilter || undefined,
      }),
  });

  const items = (applicationsQuery.data?.items ?? []) as AuthorApplicationItem[];
  const total = applicationsQuery.data?.total ?? 0;
  const errorMessage = applicationsQuery.isError
    ? errorText(applicationsQuery.error)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="作者审核"
        description="通过审核的会员可在门户创建作品并连载章节；驳回时请填写原因。"
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AuthorStatus | '')}
            aria-label="申请状态筛选"
            className="w-full sm:w-36"
          >
            <option value="">全部状态</option>
            {(Object.keys(AUTHOR_STATUS_LABELS) as AuthorStatus[]).map((status) => (
              <option key={status} value={status}>
                {AUTHOR_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted-foreground sm:ml-auto">共 {total} 条申请</span>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {applicationsQuery.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : errorMessage ? (
          <EmptyState
            icon={TriangleAlert}
            title="作者申请加载失败"
            description={errorMessage}
            action={
              <Button variant="outline" size="sm" onClick={() => void applicationsQuery.refetch()}>
                重新加载
              </Button>
            }
          />
        ) : !items.length ? (
          <EmptyState
            icon={PenTool}
            title={statusFilter ? '该状态下暂无申请' : '暂无作者申请'}
            description="会员在门户提交作者申请后会显示在这里。"
          />
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">会员</TableHead>
                <TableHead className="w-32">笔名</TableHead>
                <TableHead className="min-w-[200px]">简介</TableHead>
                <TableHead className="w-32">联系方式</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead className="w-36">申请时间</TableHead>
                <TableHead className="w-16 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((application) => {
                const actions: RowActionItem[] = [
                  {
                    label: '审核',
                    icon: <ShieldCheck className="h-3.5 w-3.5" />,
                    disabled: !canReview,
                    onSelect: () => setReviewTarget(application),
                  },
                ];
                return (
                  <TableRow key={application.id}>
                    <TableCell>
                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {application.member?.nickname ?? application.member?.username ?? application.memberId}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {application.member?.email ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1 text-xs text-foreground/90">{application.penName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-2 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                        {application.bio || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {application.contact || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <AuthorStatusBadge status={application.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(application.appliedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions items={actions} label="申请操作" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!applicationsQuery.isLoading && !errorMessage && total > 0 ? (
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

      <AuthorReviewDialog
        application={reviewTarget}
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
      />
    </div>
  );
}
