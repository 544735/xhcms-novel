import { Injectable, NotFoundException } from '@nestjs/common';
import type { NovelDashboardStats } from '@wmcms/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { startOfToday } from '../reader/reader.util';

/** 插件附加的运营建议 */
export interface NovelStatsInsight {
  level: 'info' | 'warning' | string;
  text: string;
}

export interface NovelStatsResult extends NovelDashboardStats {
  insights: NovelStatsInsight[];
}

/**
 * 小说站仪表盘统计（站点级）。
 *
 * 说明：
 * - revenue 按「已支付订单」统计书币收入（含赠送书币）；
 * - reads.today 当前数据模型未记录逐日 PV，使用「今日更新章节的累计浏览」近似；
 * - 最后调用 dashboard.afterStats 钩子追加运营建议（novel-seo 插件实现）。
 */
@Injectable()
export class NovelDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginHost: PluginHostService,
  ) {}

  async stats(siteId: string): Promise<NovelStatsResult> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('站点不存在');

    const today = startOfToday();
    const novelScope = { novel: { siteId } };
    const memberScope = { member: { siteId } };

    const [
      novelTotal,
      novelSerial,
      novelCompleted,
      novelPending,
      novelToday,
      chapterTotal,
      chapterToday,
      chapterWords,
      todayCoins,
      totalCoins,
      ordersToday,
      ordersPaid,
      memberTotal,
      memberToday,
      readsTotal,
      readsToday,
      authorApplications,
      pendingComments,
      collectTasks,
    ] = await Promise.all([
      this.prisma.novel.count({ where: { siteId } }),
      this.prisma.novel.count({ where: { siteId, status: 'serial' } }),
      this.prisma.novel.count({ where: { siteId, status: 'completed' } }),
      this.prisma.novel.count({ where: { siteId, auditStatus: 'pending' } }),
      this.prisma.novel.count({ where: { siteId, createdAt: { gte: today } } }),
      this.prisma.chapter.count({ where: novelScope }),
      this.prisma.chapter.count({ where: { ...novelScope, createdAt: { gte: today } } }),
      this.prisma.chapter.aggregate({ where: novelScope, _sum: { wordCount: true } }),
      this.prisma.order.aggregate({
        where: { ...memberScope, status: 'paid', paidAt: { gte: today } },
        _sum: { coins: true },
      }),
      this.prisma.order.aggregate({
        where: { ...memberScope, status: 'paid' },
        _sum: { coins: true },
      }),
      this.prisma.order.count({ where: { ...memberScope, createdAt: { gte: today } } }),
      this.prisma.order.count({ where: { ...memberScope, status: 'paid' } }),
      this.prisma.member.count({ where: { siteId } }),
      this.prisma.member.count({ where: { siteId, createdAt: { gte: today } } }),
      this.prisma.chapter.aggregate({ where: novelScope, _sum: { views: true } }),
      this.prisma.chapter.aggregate({
        where: { ...novelScope, updatedAt: { gte: today } },
        _sum: { views: true },
      }),
      this.prisma.authorProfile.count({ where: { status: 'pending', ...memberScope } }),
      this.prisma.novelComment.count({ where: { siteId, status: 'pending' } }),
      this.prisma.collectTask.count({ where: { siteId } }),
    ]);

    const stats: NovelDashboardStats = {
      novels: {
        total: novelTotal,
        serial: novelSerial,
        completed: novelCompleted,
        pending: novelPending,
        today: novelToday,
      },
      chapters: {
        total: chapterTotal,
        today: chapterToday,
        words: chapterWords._sum.wordCount ?? 0,
      },
      revenue: {
        todayCoins: todayCoins._sum.coins ?? 0,
        totalCoins: totalCoins._sum.coins ?? 0,
        ordersToday,
        ordersPaid,
      },
      members: { total: memberTotal, today: memberToday },
      reads: {
        total: readsTotal._sum.views ?? 0,
        today: readsToday._sum.views ?? 0,
      },
      authorApplications,
      pendingComments,
      collectTasks: collectTasks,
    };

    const hooked = await this.pluginHost.runHook<{ insights?: NovelStatsInsight[] }>(
      'dashboard.afterStats',
      { siteId, stats },
    );
    const insights = Array.isArray(hooked?.insights) ? hooked.insights : [];

    return { ...stats, insights };
  }
}
