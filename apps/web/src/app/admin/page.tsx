'use client';

import type { NovelDashboardStats } from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CloudDownload,
  Eye,
  Layers,
  LayoutDashboard,
  MessageSquare,
  PenTool,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DonutChart } from '@/components/ui/charts';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { formatNumber } from '@/lib/utils';
import { novelDashboardApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

interface NovelInsight {
  /** 后端插件钩子当前返回：{ level, text }；保留 title/description 兼容旧形状 */
  level?: string;
  text?: string;
  type?: string;
  title?: string;
  description?: string;
}

const INSIGHT_LEVEL_LABEL: Record<string, string> = {
  info: '提示',
  success: '建议',
  warning: '提醒',
  danger: '风险',
};

function insightTone(level: string | undefined): 'info' | 'success' | 'warning' | 'destructive' {
  if (level === 'warning') return 'warning';
  if (level === 'success') return 'success';
  if (level === 'danger') return 'destructive';
  return 'info';
}

type StatsWithInsights = NovelDashboardStats & { insights?: NovelInsight[] };

export default function AdminDashboardPage() {
  return (
    <PermissionGate permission="dashboard:view">
      <NovelDashboardContent />
    </PermissionGate>
  );
}

const TODO_ITEMS = [
  {
    key: 'novels',
    label: '待审核书籍',
    description: '作者提交或待上架作品',
    href: '/admin/novels?auditStatus=pending',
    icon: ShieldCheck,
    accent: 'amber',
  },
  {
    key: 'authors',
    label: '待审作者申请',
    description: '通过后作者才能发布作品',
    href: '/admin/authors?status=pending',
    icon: PenTool,
    accent: 'violet',
  },
  {
    key: 'comments',
    label: '待审书评/章评',
    description: '门户互动内容审核',
    href: '/admin/novel-comments?status=pending',
    icon: MessageSquare,
    accent: 'sky',
  },
  {
    key: 'collect',
    label: '采集任务',
    description: '查看采集执行记录',
    href: '/admin/collect',
    icon: CloudDownload,
    accent: 'emerald',
  },
] as const;

function NovelDashboardContent() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const currentSite = useAuthStore((state) => state.currentSite());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['novel-dashboard', currentSiteId],
    queryFn: () => novelDashboardApi.stats(),
    enabled: Boolean(currentSiteId),
  });

  if (!currentSiteId) {
    return (
      <div className="space-y-6">
        <PageHeader title="仪表盘" description="当前账号还没有可访问的站点。" />
        <Card>
          <EmptyState
            icon={LayoutDashboard}
            title="还没有可用站点"
            description="请先在站点管理中创建站点，或联系超级管理员为你的账号授权站点。"
            action={
              <Button size="sm" onClick={() => router.push('/admin/sites')}>
                前往站点管理
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="仪表盘" description="查看站点书籍与运营概况" />
        <QueryErrorState
          title="仪表盘数据加载失败"
          description={error instanceof Error ? error.message : '无法获取统计数据，请稍后重试。'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const stats = data as StatsWithInsights;
  const insights = stats.insights ?? [];
  const otherNovels = Math.max(0, stats.novels.total - stats.novels.serial - stats.novels.completed - stats.novels.pending);

  const todoCounts: Record<(typeof TODO_ITEMS)[number]['key'], number> = {
    novels: stats.novels.pending,
    authors: stats.authorApplications,
    comments: stats.pendingComments,
    collect: stats.collectTasks,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={currentSite ? `${currentSite.name} · /${currentSite.slug}` : undefined}
        title="仪表盘"
        description={`欢迎回来，${user?.nickname ?? user?.username ?? '管理员'}。这里是小说站今天的内容与运营概况。`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              onClick={() => router.push('/admin/novel-comments')}
            >
              评论审核
            </Button>
            <Button size="sm" icon={<BookOpen className="h-3.5 w-3.5" />} onClick={() => router.push('/admin/novels/new')}>
              新建书籍
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="书籍总数"
          value={formatNumber(stats.novels.total)}
          icon={BookOpen}
          accent="primary"
          hint={`连载 ${stats.novels.serial} · 完结 ${stats.novels.completed}`}
        />
        <StatCard
          title="章节 / 字数"
          value={`${formatNumber(stats.chapters.total)} 章`}
          icon={Layers}
          accent="violet"
          hint={`${formatNumber(stats.chapters.words)} 字 · 今日 +${formatNumber(stats.chapters.today)}`}
        />
        <StatCard
          title="今日营收（书币）"
          value={formatNumber(stats.revenue.todayCoins)}
          icon={Wallet}
          accent="emerald"
          hint={`今日订单 ${stats.revenue.ordersToday} · 累计 ${formatNumber(stats.revenue.totalCoins)}`}
        />
        <StatCard
          title="会员总数"
          value={formatNumber(stats.members.total)}
          icon={Users}
          accent="sky"
          hint={`今日新增 ${formatNumber(stats.members.today)}`}
        />
        <StatCard
          title="阅读量"
          value={formatNumber(stats.reads.total)}
          icon={Eye}
          accent="rose"
          hint={`今日阅读 ${formatNumber(stats.reads.today)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>书籍状态分布</CardTitle>
            <CardDescription>按审核与连载状态拆分书籍总量</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <DonutChart
              centerLabel="书籍总数"
              centerValue={formatNumber(stats.novels.total)}
              segments={[
                { label: '连载中', value: stats.novels.serial, color: '#6366f1' },
                { label: '已完结', value: stats.novels.completed, color: '#22c55e' },
                { label: '待审核', value: stats.novels.pending, color: '#f59e0b' },
                { label: '其他', value: otherNovels, color: '#94a3b8' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>运营待办</CardTitle>
            <CardDescription>需要处理的审核与任务</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {TODO_ITEMS.map((item) => {
              const Icon = item.icon;
              const count = todoCounts[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                  </span>
                  <Badge variant={count > 0 ? 'warning' : 'secondary'}>{count}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              插件洞察
            </CardTitle>
            <CardDescription>由内置插件基于当前数据生成</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.length ? (
              <ul className="space-y-3">
                {insights.map((insight, index) => {
                  const level = insight.level ?? insight.type ?? 'info';
                  const title = insight.title ?? INSIGHT_LEVEL_LABEL[level] ?? '运营建议';
                  const description = insight.description ?? insight.text;
                  return (
                    <li
                      key={`${title}-${index}`}
                      className="rounded-lg border border-border/70 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <TrendingUp className="h-3.5 w-3.5 text-primary" />
                          {title}
                        </p>
                        <Badge variant={insightTone(level)}>
                          {INSIGHT_LEVEL_LABEL[level] ?? '提示'}
                        </Badge>
                      </div>
                      {description ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {description}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={Sparkles}
                title="暂无插件洞察"
                description="启用 SEO 分析等插件后，会在此展示运营建议。"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="今日新增书籍" value={stats.novels.today} />
        <MiniStat label="今日新增章节" value={stats.chapters.today} />
        <MiniStat label="已支付订单" value={stats.revenue.ordersPaid} />
        <MiniStat label="今日阅读量" value={stats.reads.today} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        数据口径：{stats.revenue.todayCoins > 0 ? '书币营收含充值套餐赠送；' : ''}
        阅读量为书籍与章节浏览累计，实时统计。插件：dashboard.afterStats。
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{formatNumber(value)}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="仪表盘加载中">
      <Skeleton className="h-16 w-full max-w-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-4 h-44 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
