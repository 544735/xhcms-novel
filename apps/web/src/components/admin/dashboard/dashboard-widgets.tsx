'use client';

import type { DashboardStats } from '@wmcms/shared';
import {
  Blocks,
  Building2,
  Clock,
  Database,
  Info,
  MessageSquare,
  Server,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BarList, DonutChart } from '@/components/ui/charts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/admin/system/status-badge';
import { formatRelative, truncate } from '@/lib/utils';

export interface DashboardInsight {
  level: 'info' | 'warning';
  text: string;
}

function WidgetCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 文章状态分布                                                         */
/* ------------------------------------------------------------------ */

export function ArticleStatusCard({ stats }: { stats: DashboardStats }) {
  const { total, published, draft } = stats.articles;
  const other = Math.max(0, total - published - draft);

  return (
    <WidgetCard title="文章状态分布" description="当前站点的文章发布情况">
      {total > 0 ? (
        <DonutChart
          segments={[
            { label: '已发布', value: published, color: '#22c55e' },
            { label: '草稿', value: draft, color: '#f59e0b' },
            { label: '其他', value: other, color: '#94a3b8' },
          ]}
          centerLabel="文章总数"
          centerValue={total}
        />
      ) : (
        <EmptyState compact icon={MessageSquare} title="暂无文章" description="发布第一篇内容后，这里会展示状态分布。" />
      )}
    </WidgetCard>
  );
}

/* ------------------------------------------------------------------ */
/* 热门文章 Top5                                                        */
/* ------------------------------------------------------------------ */

export function TopArticlesCard({ articles }: { articles: DashboardStats['views']['topArticles'] }) {
  return (
    <WidgetCard
      title="热门文章 Top5"
      description="按累计浏览量排序"
      action={
        <Link
          href="/admin/articles"
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
        >
          全部文章
        </Link>
      }
    >
      {articles.length ? (
        <BarList
          data={articles.slice(0, 5).map((article) => ({
            label: truncate(article.title, 18),
            value: article.views,
          }))}
        />
      ) : (
        <EmptyState compact title="暂无浏览数据" description="文章被访问后这里会显示排行。" />
      )}
    </WidgetCard>
  );
}

/* ------------------------------------------------------------------ */
/* 待审核评论                                                           */
/* ------------------------------------------------------------------ */

export function PendingCommentsCard({
  comments,
  pending,
}: {
  comments: DashboardStats['recentComments'];
  pending: number;
}) {
  const items = comments.filter((comment) => comment.status === 'pending');

  return (
    <WidgetCard
      title="待审核评论"
      description="点击任意条目进入评论审核台"
      action={<Badge variant={pending > 0 ? 'warning' : 'secondary'}>{pending} 条待审</Badge>}
    >
      {items.length ? (
        <ul className="-mx-2 space-y-1">
          {items.map((comment) => (
            <li key={comment.id}>
              <Link
                href="/admin/comments"
                className="block rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{comment.nickname}</span>
                  <span className="shrink-0 text-muted-foreground">{formatRelative(comment.createdAt)}</span>
                  <StatusBadge status={comment.status} className="ml-auto" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {truncate(comment.content, 72)}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground/80">
                  《{comment.articleTitle ?? '未关联文章'}》
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={MessageSquare}
          title="暂无待审核评论"
          description="所有评论都已处理完毕，或最近暂无新的评论。"
          action={
            <Link
              href="/admin/comments"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              查看全部评论
            </Link>
          }
        />
      )}
    </WidgetCard>
  );
}

/* ------------------------------------------------------------------ */
/* 插件洞察                                                             */
/* ------------------------------------------------------------------ */

export function InsightsCard({ insights }: { insights: DashboardInsight[] }) {
  return (
    <WidgetCard title="运营洞察" description="由已启用插件根据数据生成">
      {insights.length ? (
        <ul className="space-y-2.5">
          {insights.map((insight, index) => {
            const warning = insight.level === 'warning';
            return (
              <li
                key={`${insight.level}-${index}`}
                className="flex items-start gap-2.5 rounded-lg border border-border/70 p-2.5"
              >
                <span
                  className={
                    warning
                      ? 'mt-0.5 shrink-0 text-warning'
                      : 'mt-0.5 shrink-0 text-sky-500 dark:text-sky-400'
                  }
                >
                  {warning ? <TriangleAlert className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                </span>
                <p className="text-xs leading-relaxed text-foreground/85">{insight.text}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={Info}
          title="暂无运营洞察"
          description="启用 SEO 分析插件后，这里会根据统计数据给出运营建议。"
          action={
            <Link
              href="/admin/plugins"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              前往插件中心
            </Link>
          }
        />
      )}
    </WidgetCard>
  );
}

/* ------------------------------------------------------------------ */
/* 系统信息                                                             */
/* ------------------------------------------------------------------ */

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.floor(seconds)} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${Math.floor(seconds % 60)} 秒`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours} 小时 ${minutes} 分`;
  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
}

export function SystemInfoCard({
  system,
  siteName,
}: {
  system: DashboardStats['system'];
  siteName?: string;
}) {
  const rows = [
    { icon: Building2, label: '当前站点', value: siteName ?? '—' },
    { icon: Server, label: 'Node 版本', value: system.nodeVersion || '—' },
    { icon: Clock, label: '运行时长', value: formatUptime(system.uptime) },
    { icon: Database, label: '数据库', value: system.database || '—' },
    { icon: Blocks, label: '启用插件', value: `${system.pluginsEnabled} 个` },
    { icon: Building2, label: '站点总数', value: `${system.sites} 个` },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统信息</CardTitle>
        <CardDescription>服务运行状态与平台概况</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-border/70 bg-muted/30 p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <row.icon className="h-3.5 w-3.5" />
                {row.label}
              </dt>
              <dd className="mt-1.5 truncate text-sm font-semibold text-foreground" title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

