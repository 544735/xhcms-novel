'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, History, Library, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { BookCover } from '@/components/portal/client/book-cover';
import { NovelStatusBadge } from '@/components/portal/client/novel-badges';
import { useMemberGuard } from '@/components/portal/member/member-guard';
import { MemberPageFrame } from '@/components/portal/member/member-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { readerApi, ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/utils';

type ShelfTab = 'shelf' | 'history';

function percentLabel(value: number | null | undefined): number {
  const raw = value ?? 0;
  const percent = raw <= 1 && raw > 0 ? raw * 100 : raw;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

function ShelfSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="flex gap-3 p-4">
            <Skeleton className="h-28 w-20 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export interface ShelfViewProps {
  siteSlug: string;
  basePath: string;
  initialTab?: ShelfTab;
}

/** 我的书架 + 阅读历史（同一页面内 Tab 切换，/shelf 与 /history 复用） */
export function ShelfView({ siteSlug, basePath, initialTab = 'shelf' }: ShelfViewProps) {
  const queryClient = useQueryClient();
  const { ready, handleAuthError } = useMemberGuard(basePath);
  const [tab, setTab] = React.useState<ShelfTab>(initialTab);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyPageSize, setHistoryPageSize] = React.useState(10);

  const shelfQuery = useQuery({
    queryKey: ['member', 'shelf', siteSlug],
    queryFn: () => readerApi.shelf(siteSlug),
    enabled: ready,
  });

  const historyQuery = useQuery({
    queryKey: ['member', 'history', siteSlug, historyPage, historyPageSize],
    queryFn: () => readerApi.history(siteSlug, historyPage, historyPageSize),
    enabled: ready && tab === 'history',
  });

  React.useEffect(() => {
    for (const error of [shelfQuery.error, historyQuery.error]) {
      if (error && handleAuthError(error)) break;
    }
  }, [shelfQuery.error, historyQuery.error, handleAuthError]);

  const removeMutation = useMutation({
    mutationFn: (novelId: string) => readerApi.removeShelf(siteSlug, novelId),
    onSuccess: () => {
      toast.success('已移出书架');
      void queryClient.invalidateQueries({ queryKey: ['member', 'shelf', siteSlug] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '移出书架失败，请稍后重试');
    },
  });

  const shelfItems = shelfQuery.data ?? [];

  return (
    <MemberPageFrame
      basePath={basePath}
      title="我的书架"
      description="收藏的书籍与最近阅读进度都保存在这里，登录后可跨设备同步。"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => void shelfQuery.refetch()} disabled={shelfQuery.isFetching}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          <Link
            href={`${basePath}/books`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <BookOpen className="h-3.5 w-3.5" />
            去书库
          </Link>
        </>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ShelfTab)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-none">
          <TabsTrigger value="shelf" className="justify-center">
            <Library className="mr-1 h-3.5 w-3.5" />
            书架
            {shelfItems.length ? <Badge variant="secondary" className="ml-1.5">{shelfItems.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="justify-center">
            <History className="mr-1 h-3.5 w-3.5" />
            阅读历史
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shelf">
          {!ready || shelfQuery.isLoading ? (
            <ShelfSkeleton />
          ) : shelfQuery.isError ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">书架加载失败，请稍后重试。</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void shelfQuery.refetch()}>
                  重新加载
                </Button>
              </CardContent>
            </Card>
          ) : !shelfItems.length ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Library}
                  title="书架还是空的"
                  description="在书籍详情页点击「加入书架」，就能在这里追更了。"
                  action={
                    <Link
                      href={`${basePath}/books`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                      <BookOpen className="h-4 w-4" />
                      去书库逛逛
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shelfItems.map((item) => {
                const novel = item.novel;
                const chapterNo = item.progress?.chapterNo ?? item.lastChapter?.chapterNo ?? 1;
                const percent = percentLabel(item.progress?.percent);
                return (
                  <Card key={novel.id} className="flex flex-col">
                    <CardContent className="flex flex-1 gap-3 p-4">
                      <Link href={`${basePath}/book/${novel.slug}`} className="shrink-0">
                        <BookCover src={novel.cover} title={novel.title} className="h-28 w-20" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`${basePath}/book/${novel.slug}`}
                            className="line-clamp-2 text-sm font-medium leading-snug text-foreground hover:text-primary"
                          >
                            {novel.title}
                          </Link>
                          <NovelStatusBadge status={novel.status} />
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{novel.authorName}</p>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {item.lastChapter ? `最新：第${item.lastChapter.chapterNo}章 ${item.lastChapter.title}` : '暂无章节'}
                        </p>
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(3, percent)}%` }} />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {item.progress ? `读到第 ${item.progress.chapterNo} 章 · ${percent}%` : '尚未开始阅读'}
                          </p>
                        </div>
                        <div className="mt-auto flex items-center gap-2 pt-2">
                          <Link
                            href={`${basePath}/read/${novel.slug}/${chapterNo}`}
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            继续阅读
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            loading={removeMutation.isPending && removeMutation.variables === novel.id}
                            onClick={() => removeMutation.mutate(novel.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            移出
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            {!ready || historyQuery.isLoading ? (
              <CardContent>
                <ShelfSkeleton />
              </CardContent>
            ) : historyQuery.isError ? (
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">阅读历史加载失败，请稍后重试。</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void historyQuery.refetch()}>
                  重新加载
                </Button>
              </CardContent>
            ) : !historyQuery.data?.items.length ? (
              <EmptyState
                icon={History}
                title="还没有阅读记录"
                description="开始阅读任意章节后，进度会自动记录在这里。"
                action={
                  <Link
                    href={`${basePath}/books`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    <BookOpen className="h-4 w-4" />
                    去书库
                  </Link>
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-border/70">
                  {historyQuery.data.items.map((item) => {
                    const percent = percentLabel(item.percent);
                    return (
                      <li key={`${item.novel.id}-${item.chapterId}`} className="flex gap-3 p-4">
                        <Link href={`${basePath}/book/${item.novel.slug}`} className="shrink-0">
                          <BookCover src={item.novel.cover} title={item.novel.title} className="h-20 w-14" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`${basePath}/book/${item.novel.slug}`}
                              className="truncate text-sm font-medium text-foreground hover:text-primary"
                            >
                              {item.novel.title}
                            </Link>
                            <NovelStatusBadge status={item.novel.status} />
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            第 {item.chapterNo} 章 · {item.chapterTitle}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, percent)}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{percent}%</span>
                          </div>
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                            <span className="text-[11px] text-muted-foreground">
                              上次阅读 {formatRelative(item.updatedAt)}
                            </span>
                            <Link
                              href={`${basePath}/read/${item.novel.slug}/${item.chapterNo}`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              继续阅读
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-border/70 px-4">
                  <Pagination
                    page={historyPage}
                    pageSize={historyPageSize}
                    total={historyQuery.data.total}
                    onPageChange={setHistoryPage}
                    onPageSizeChange={(size) => {
                      setHistoryPageSize(size);
                      setHistoryPage(1);
                    }}
                  />
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </MemberPageFrame>
  );
}
