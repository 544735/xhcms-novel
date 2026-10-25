'use client';

import type { DashboardStats } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Eye,
  FileText,
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  ArticleStatusCard,
  InsightsCard,
  PendingCommentsCard,
  SystemInfoCard,
  TopArticlesCard,
  type DashboardInsight,
} from '@/components/admin/dashboard/dashboard-widgets';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendChart } from '@/components/ui/charts';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { formatNumber, truncate } from '@/lib/utils';

type DashboardStatsWithInsights = DashboardStats & { insights?: DashboardInsight[] };

const TREND_METRICS = [
  { key: 'articles', label: '文章', color: '#6366f1' },
  { key: 'comments', label: '评论', color: '#22c55e' },
  { key: 'views', label: '浏览', color: '#0ea5e9' },
] as const;

type TrendMetric = (typeof TREND_METRICS)[number]['key'];

function TrendCard({ stats }: { stats: DashboardStats }) {
  const [metric, setMetric] = React.useState<TrendMetric>('articles');
  const activeMetric = TREND_METRICS.find((item) => item.key === metric) ?? TREND_METRICS[0];

  const series = React.useMemo(
    () =>
      stats.trend.map((point) => ({
        label: point.date.length > 5 ? point.date.slice(5) : point.date,
        value: point[metric] ?? 0,
      })),
    [stats.trend, metric],
  );
  const hasData = series.some((point) => point.value > 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle>最近 7 天趋势</CardTitle>
          <CardDescription className="mt-1">内容产出、互动与流量的每日变化</CardDescription>
        </div>
        <Tabs value={metric} onValueChange={(value) => setMetric(value as TrendMetric)}>
          <TabsList>
            {TREND_METRICS.map((item) => (
              <TabsTrigger key={item.key} value={item.key}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-4">
        {!stats.trend.length ? (
          <EmptyState
            compact
            icon={TrendingUp}
            title="暂无趋势数据"
            description="接口尚未返回最近 7 天的统计数据。"
          />
        ) : !hasData ? (
          <EmptyState
            compact
            icon={TrendingUp}
            title={`近 7 天暂无${activeMetric.label}数据`}
            description="产生数据后，这里会自动绘制趋势曲线。"
          />
        ) : (
          <TrendChart data={series} color={activeMetric.color} height={220} />
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="仪表盘加载中">
      <Skeleton className="h-16 w-full max-w-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-56 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-48 w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-5 w-28" />
              <div className="mt-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DashboardView() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const currentSite = useAuthStore((state) => state.currentSite());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats', currentSiteId],
    queryFn: () => api.dashboard.stats(),
    enabled: Boolean(currentSiteId),
  });

  if (!currentSiteId) {
    return (
      <div className="space-y-6">
        <PageHeader title="仪表盘" description="当前账号还没有可访问的站点。" />
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={LayoutDashboard}
            title="还没有可用站点"
            description="请先在站点管理中创建站点，或联系超级管理员为你的账号授权站点。"
            action={
              <Link
                href="/admin/sites"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                前往站点管理
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="仪表盘" description="查看站点运营概况" />
        <QueryErrorState
          title="仪表盘数据加载失败"
          description={error instanceof ApiError ? error.message : '无法获取统计数据，请稍后重试。'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const stats = data as DashboardStatsWithInsights;
  const insights = stats.insights ?? [];
  const todayViews = stats.trend.length ? (stats.trend[stats.trend.length - 1]?.views ?? 0) : stats.trend[0]?.views ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={currentSite ? `${currentSite.name} · /${currentSite.slug}` : undefined}
        title="仪表盘"
        description={`欢迎回来，${user?.nickname ?? user?.username ?? '管理员'}。这里是站点今天的内容与运营概况。`}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/admin/comments')}>
              <MessageSquare className="h-4 w-4" />
              评论审核
            </Button>
            <Button onClick={() => router.push('/admin/articles/new')}>
              <FileText className="h-4 w-4" />
              新建文章
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="文章总数"
          value={formatNumber(stats.articles.total)}
          icon={FileText}
          accent="primary"
          hint={`${stats.articles.published} 已发布 · ${stats.articles.draft} 草稿`}
        />
        <StatCard
          title="待审核评论"
          value={formatNumber(stats.comments.pending)}
          icon={MessageSquare}
          accent="amber"
          hint={`评论总数 ${formatNumber(stats.comments.total)}`}
        />
        <StatCard
          title="会员总数"
          value={formatNumber(stats.members.total)}
          icon={Users}
          accent="emerald"
          hint={`今日新增 ${formatNumber(stats.members.today)}`}
        />
        <StatCard
          title="总浏览量"
          value={formatNumber(stats.views.total)}
          icon={Eye}
          accent="sky"
          hint={`今日浏览 ${formatNumber(todayViews)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <TrendCard stats={stats} />
        <ArticleStatusCard stats={stats} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <TopArticlesCard articles={stats.views.topArticles} />
        <PendingCommentsCard comments={stats.recentComments} pending={stats.comments.pending} />
        <InsightsCard insights={insights} />
      </div>

      <SystemInfoCard system={stats.system} siteName={stats.site?.name ?? currentSite?.name} />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>最近评论动态</CardTitle>
            <CardDescription className="mt-1">最新提交的评论及审核状态</CardDescription>
          </div>
          <Link
            href="/admin/comments"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline"
          >
            进入审核台
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recentComments.length ? (
            <ul className="divide-y divide-border/70">
              {stats.recentComments.map((comment) => (
                <li key={comment.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">{comment.nickname}</span>
                      <StatusBadge status={comment.status} />
                      <span className="truncate text-muted-foreground">
                        《{comment.articleTitle ?? '未关联文章'}》
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {truncate(comment.content, 100)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={MessageSquare} title="暂无评论" description="门户产生评论后会显示在这里。" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
