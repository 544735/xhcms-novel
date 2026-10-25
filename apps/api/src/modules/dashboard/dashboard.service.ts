import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CommentStatus,
  DashboardStats,
} from '@wmcms/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PluginHostService } from '../../common/plugins/plugin-host.service';

/** 插件附加的运营建议 */
export interface DashboardInsight {
  level: 'info' | 'warning' | string;
  text: string;
}

export interface DashboardStatsResult extends DashboardStats {
  insights: DashboardInsight[];
}

const TREND_DAYS = 7;
const RECENT_COMMENT_LIMIT = 5;
const TOP_ARTICLE_LIMIT = 5;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginHost: PluginHostService,
  ) {}

  async stats(siteId: string): Promise<DashboardStatsResult> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true, slug: true },
    });
    if (!site) throw new NotFoundException('站点不存在');

    const now = new Date();
    const today = startOfDay(now);
    const trendStart = startOfDay(new Date(now.getTime() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000));

    const [
      articleTotal,
      articlePublished,
      articleDraft,
      articleToday,
      commentTotal,
      commentPending,
      commentApproved,
      memberTotal,
      memberToday,
      mediaAggregate,
      viewAggregate,
      topArticles,
      recentComments,
      pluginsEnabled,
      siteCount,
      trendArticles,
      trendComments,
    ] = await Promise.all([
      this.prisma.article.count({ where: { siteId } }),
      this.prisma.article.count({ where: { siteId, status: 'published' } }),
      this.prisma.article.count({ where: { siteId, status: 'draft' } }),
      this.prisma.article.count({ where: { siteId, createdAt: { gte: today } } }),
      this.prisma.comment.count({ where: { siteId } }),
      this.prisma.comment.count({ where: { siteId, status: 'pending' } }),
      this.prisma.comment.count({ where: { siteId, status: 'approved' } }),
      this.prisma.member.count({ where: { siteId } }),
      this.prisma.member.count({ where: { siteId, createdAt: { gte: today } } }),
      this.prisma.media.aggregate({ where: { siteId }, _count: { _all: true }, _sum: { size: true } }),
      this.prisma.article.aggregate({ where: { siteId }, _sum: { views: true } }),
      this.prisma.article.findMany({
        where: { siteId },
        orderBy: { views: 'desc' },
        take: TOP_ARTICLE_LIMIT,
        select: { id: true, title: true, views: true },
      }),
      this.prisma.comment.findMany({
        where: { siteId },
        orderBy: { createdAt: 'desc' },
        take: RECENT_COMMENT_LIMIT,
        include: { article: { select: { title: true } } },
      }),
      this.prisma.plugin.count({ where: { enabled: true } }),
      this.prisma.site.count(),
      this.prisma.article.findMany({
        where: {
          siteId,
          OR: [{ createdAt: { gte: trendStart } }, { publishedAt: { gte: trendStart } }],
        },
        select: { createdAt: true, publishedAt: true, views: true },
      }),
      this.prisma.comment.findMany({
        where: { siteId, createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
    ]);

    // 最近 7 天趋势（含今天）：文章/评论按创建日统计；
    // 浏览量为「当日发布文章的累计浏览量」估算（当前数据模型未记录逐日 PV）。
    const trend: DashboardStats['trend'] = [];
    for (let offset = TREND_DAYS - 1; offset >= 0; offset -= 1) {
      const day = startOfDay(new Date(today.getTime() - offset * 24 * 60 * 60 * 1000));
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const key = dayKey(day);

      const articles = trendArticles.filter(
        (row) => row.createdAt >= day && row.createdAt < next,
      ).length;
      const comments = trendComments.filter(
        (row) => row.createdAt >= day && row.createdAt < next,
      ).length;
      const views = trendArticles
        .filter((row) => row.publishedAt && row.publishedAt >= day && row.publishedAt < next)
        .reduce((sum, row) => sum + (row.views ?? 0), 0);

      trend.push({ date: key, articles, comments, views });
    }

    const stats: DashboardStats = {
      site: { id: site.id, name: site.name, slug: site.slug },
      articles: {
        total: articleTotal,
        published: articlePublished,
        draft: articleDraft,
        today: articleToday,
      },
      comments: {
        total: commentTotal,
        pending: commentPending,
        approved: commentApproved,
      },
      members: { total: memberTotal, today: memberToday },
      media: {
        total: mediaAggregate._count._all,
        size: mediaAggregate._sum.size ?? 0,
      },
      views: {
        total: viewAggregate._sum.views ?? 0,
        topArticles: topArticles.map((row) => ({
          id: row.id,
          title: row.title,
          views: row.views,
        })),
      },
      trend,
      recentComments: recentComments.map((row) => ({
        id: row.id,
        nickname: row.nickname,
        content: row.content,
        status: row.status as CommentStatus,
        articleTitle: row.article?.title ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      system: {
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
        database: 'SQLite',
        pluginsEnabled,
        sites: siteCount,
      },
    };

    // 插件钩子：附加运营建议（seo-analyzer 等内置插件实现）
    const hooked = await this.pluginHost.runHook<{ insights?: DashboardInsight[] }>(
      'dashboard.afterStats',
      { siteId, stats },
    );
    const insights = Array.isArray(hooked?.insights) ? hooked.insights : [];

    return { ...stats, insights };
  }
}
