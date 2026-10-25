'use client';

import type { AuthorNovelItem, NovelInput } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  BookOpen,
  Clock,
  Eye,
  FileText,
  Heart,
  Pencil,
  PenTool,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { AuthorApplyCard } from '@/components/portal/author/author-apply-card';
import { AuthorChapterPanel } from '@/components/portal/author/author-chapter-panel';
import {
  AuthorNovelFormDialog,
  type AuthorCategoryOption,
} from '@/components/portal/author/author-novel-form-dialog';
import { formatWordCount } from '@/components/portal/author/word-count';
import { BookCover } from '@/components/portal/client/book-cover';
import { memberClient } from '@/components/portal/client/member-client';
import {
  AuthorStatusBadge,
  NovelAuditBadge,
  NovelStatusBadge,
} from '@/components/portal/client/novel-badges';
import { useMemberGuard } from '@/components/portal/member/member-guard';
import { MemberPageFrame } from '@/components/portal/member/member-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { readerApi, ApiError } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/utils';

function AuthorCenterSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex gap-3 p-4">
              <Skeleton className="h-28 w-20 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <SkeletonText lines={2} />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export interface AuthorCenterViewProps {
  siteSlug: string;
  basePath: string;
}

/**
 * 作者中心：
 * - 未申请：申请表单；
 * - 待审核 / 驳回：状态说明（驳回展示原因）；
 * - 已通过：数据卡 + 作品 CRUD + 章节列表/编辑器。
 */
export function AuthorCenterView({ siteSlug, basePath }: AuthorCenterViewProps) {
  const queryClient = useQueryClient();
  const { ready, handleAuthError } = useMemberGuard(basePath);

  const [page, setPage] = React.useState(1);
  const [novelDialogOpen, setNovelDialogOpen] = React.useState(false);
  const [editingNovel, setEditingNovel] = React.useState<AuthorNovelItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AuthorNovelItem | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const authorQuery = useQuery({
    queryKey: ['member', 'author', siteSlug],
    queryFn: () => readerApi.authorProfile(siteSlug),
    enabled: ready,
  });

  const profile = authorQuery.data ?? null;
  const approved = profile?.status === 'approved';

  const statsQuery = useQuery({
    queryKey: ['member', 'author', 'stats', siteSlug],
    queryFn: () => readerApi.authorStats(siteSlug),
    enabled: ready && approved,
  });

  const novelsQuery = useQuery({
    queryKey: ['member', 'author', 'novels', siteSlug, page],
    queryFn: () => readerApi.authorNovels(siteSlug, page, 9),
    enabled: ready && approved,
  });

  const categoriesQuery = useQuery({
    queryKey: ['member', 'author', 'categories', siteSlug],
    queryFn: () => memberClient.novelCategories(siteSlug),
    enabled: ready && approved,
    staleTime: 5 * 60_000,
  });

  React.useEffect(() => {
    for (const error of [
      authorQuery.error,
      statsQuery.error,
      novelsQuery.error,
      categoriesQuery.error,
    ]) {
      if (error && handleAuthError(error)) break;
    }
  }, [authorQuery.error, statsQuery.error, novelsQuery.error, categoriesQuery.error, handleAuthError]);

  const categories: AuthorCategoryOption[] = React.useMemo(
    () => (categoriesQuery.data ?? []).map((category) => ({ id: category.id, name: category.name })),
    [categoriesQuery.data],
  );

  const invalidateAuthorData = () => {
    void queryClient.invalidateQueries({ queryKey: ['member', 'author'] });
  };

  const saveNovelMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: NovelInput }) =>
      id
        ? readerApi.updateAuthorNovel(siteSlug, id, input)
        : readerApi.createAuthorNovel(siteSlug, input),
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? '作品信息已更新' : '作品已创建，等待管理员审核');
      invalidateAuthorData();
      setNovelDialogOpen(false);
      setEditingNovel(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '作品保存失败，请稍后重试');
    },
  });

  const deleteNovelMutation = useMutation({
    mutationFn: (novelId: string) => readerApi.deleteAuthorNovel(siteSlug, novelId),
    onSuccess: () => {
      toast.success('作品已删除');
      invalidateAuthorData();
      setDeleteTarget(null);
      setSelectedId(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '作品删除失败');
    },
  });

  const novels = novelsQuery.data?.items ?? [];
  const selectedNovel = novels.find((novel) => novel.id === selectedId) ?? null;
  const stats = statsQuery.data;

  const refreshAll = () => {
    void authorQuery.refetch();
    if (approved) {
      void statsQuery.refetch();
      void novelsQuery.refetch();
    }
  };

  return (
    <MemberPageFrame
      basePath={basePath}
      title="作者中心"
      description="管理你的作品与章节，查看创作数据。作者作品需管理员审核后才会在书库上架。"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={authorQuery.isFetching}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          {approved ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingNovel(null);
                setNovelDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              新建作品
            </Button>
          ) : null}
        </>
      }
    >
      {!ready || authorQuery.isLoading ? (
        <AuthorCenterSkeleton />
      ) : authorQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">作者信息加载失败，请稍后重试。</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void authorQuery.refetch()}>
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : !profile ? (
        <AuthorApplyCard siteSlug={siteSlug} onApplied={() => void authorQuery.refetch()} />
      ) : profile.status !== 'approved' ? (
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {profile.status === 'pending' ? (
                <Clock className="h-4 w-4 text-warning" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              作者申请{profile.status === 'pending' ? '审核中' : '未通过'}
              <AuthorStatusBadge status={profile.status} />
            </CardTitle>
            <CardDescription>
              {profile.status === 'pending'
                ? '管理员审核通过后，即可创建作品并发布章节。审核结果会在本页更新。'
                : '很抱歉，本次作者申请未通过。你可以根据驳回原因调整后联系管理员重新审核。'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs sm:grid-cols-2">
              <p className="text-muted-foreground">
                笔名：<span className="font-medium text-foreground">{profile.penName}</span>
              </p>
              <p className="text-muted-foreground">
                提交时间：<span className="text-foreground">{formatDateTime(profile.appliedAt)}</span>
              </p>
              {profile.contact ? (
                <p className="truncate text-muted-foreground">
                  联系方式：<span className="text-foreground">{profile.contact}</span>
                </p>
              ) : null}
              {profile.reviewedAt ? (
                <p className="text-muted-foreground">
                  审核时间：<span className="text-foreground">{formatDateTime(profile.reviewedAt)}</span>
                </p>
              ) : null}
            </div>
            {profile.status === 'rejected' && profile.rejectReason ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
                驳回原因：{profile.rejectReason}
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void authorQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新审核状态
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* 数据卡 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: '作品数', value: formatNumber(stats?.novelCount ?? 0), icon: BookOpen },
              { label: '章节数', value: formatNumber(stats?.chapterCount ?? 0), icon: FileText },
              { label: '总字数', value: formatWordCount(stats?.totalWords ?? 0), icon: AlignLeft },
              { label: '总阅读', value: formatNumber(stats?.totalViews ?? 0), icon: Eye },
              { label: '总收藏', value: formatNumber(stats?.totalFavorites ?? 0), icon: Heart },
              { label: '今日阅读', value: formatNumber(stats?.todayViews ?? 0), icon: TrendingUp },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <p className="mt-1.5 truncate text-lg font-semibold tracking-tight text-foreground">
                  {statsQuery.isLoading ? '—' : item.value}
                </p>
              </div>
            ))}
          </div>

          {/* 作品列表 */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PenTool className="h-4 w-4 text-primary" />
                我的作品
                <Badge variant="secondary">{novelsQuery.data?.total ?? 0}</Badge>
              </h2>
              <span className="text-[11px] text-muted-foreground">点击「管理章节」维护正文</span>
            </div>

            {novelsQuery.isLoading ? (
              <AuthorCenterSkeleton />
            ) : novelsQuery.isError ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">作品列表加载失败。</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void novelsQuery.refetch()}>
                    重新加载
                  </Button>
                </CardContent>
              </Card>
            ) : !novels.length ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={PenTool}
                    title="还没有作品"
                    description="创建第一部作品，等待管理员审核后即可在书库上架。"
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingNovel(null);
                          setNovelDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        新建作品
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {novels.map((novel) => (
                    <Card key={novel.id} className="flex flex-col">
                      <CardContent className="flex flex-1 gap-3 p-4">
                        <BookCover src={novel.cover} title={novel.title} className="h-32 w-22" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                              {novel.title}
                            </p>
                            <NovelAuditBadge status={novel.auditStatus} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <NovelStatusBadge status={novel.status} />
                            {novel.vipOnly ? <Badge variant="purple">整本 VIP</Badge> : null}
                            {novel.pendingChapters > 0 ? (
                              <Badge variant="warning">{novel.pendingChapters} 章待审</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {formatWordCount(novel.words)} · {novel.chapterCount} 章 · {formatNumber(novel.views)} 阅读
                          </p>
                          <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
                            <Button
                              size="sm"
                              variant={selectedId === novel.id ? 'default' : 'outline'}
                              onClick={() => setSelectedId(selectedId === novel.id ? null : novel.id)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              管理章节
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNovel(novel);
                                setNovelDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(novel)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {(novelsQuery.data?.total ?? 0) > 9 ? (
                  <div className="mt-2">
                    <Pagination
                      page={page}
                      pageSize={9}
                      total={novelsQuery.data?.total ?? 0}
                      onPageChange={setPage}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* 章节管理 */}
          {selectedNovel ? (
            <AuthorChapterPanel
              key={selectedNovel.id}
              siteSlug={siteSlug}
              novel={selectedNovel}
              onChanged={invalidateAuthorData}
              onAuthError={handleAuthError}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <p className="text-xs text-muted-foreground">
                  选择上方任意作品，即可查看章节列表、新建章节与编辑正文。
                </p>
                <Link
                  href={`${basePath}/book/${novels[0]?.slug ?? ''}`}
                  className="hidden text-xs text-primary hover:underline"
                >
                  查看作品页
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AuthorNovelFormDialog
        open={novelDialogOpen}
        onOpenChange={(open) => {
          setNovelDialogOpen(open);
          if (!open) setEditingNovel(null);
        }}
        novel={editingNovel}
        penName={profile?.penName ?? ''}
        categories={categories}
        saving={saveNovelMutation.isPending}
        onSubmit={(input) => saveNovelMutation.mutate({ id: editingNovel?.id, input })}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除作品"
        description={
          deleteTarget
            ? `确定删除作品「${deleteTarget.title}」吗？其章节与评论会一并删除，且不可撤销。`
            : undefined
        }
        confirmText="删除"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteNovelMutation.mutateAsync(deleteTarget.id);
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />
    </MemberPageFrame>
  );
}
