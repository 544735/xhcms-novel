import { BUILTIN_PLUGINS } from '@wmcms/shared';
import { stripHtml } from '../../utils/sanitize.util';
import type { BuiltinPluginDefinition } from '../plugin.types';

interface NovelLike {
  title?: string;
  summary?: string | null;
  cover?: string | null;
  authorName?: string;
  categoryName?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/**
 * 书籍 SEO 优化
 * - novel.beforeCreate：缺省时自动生成简介、SEO 标题，并输出优化建议
 * - dashboard.afterStats：根据书籍/订单/评论数据给出运营建议 insights
 */
export const novelSeoPlugin: BuiltinPluginDefinition = {
  manifest: BUILTIN_PLUGINS.find((p) => p.key === 'novel-seo')!,
  handlers: {
    'novel.beforeCreate': (payload, ctx) => {
      const novel = payload as NovelLike;
      const titleMin = Number(ctx.config.titleMin ?? 2);
      const titleMax = Number(ctx.config.titleMax ?? 30);
      const summaryMin = Number(ctx.config.summaryMin ?? 40);
      const patch: Record<string, unknown> = {};
      const warnings: string[] = [];

      const title = stripHtml(novel.title ?? '');
      if (title.length < titleMin) warnings.push('书名过短，不利于搜索识别');
      if (title.length > titleMax) warnings.push(`书名偏长（${title.length} 字），建议精简`);

      if (!novel.summary) {
        const auto = `${novel.authorName ?? '匿名作者'} 的${novel.categoryName ? `${novel.categoryName}类` : ''}作品《${title}》，欢迎阅读与收藏。`;
        patch.summary = auto;
        warnings.push('缺少简介，已自动生成占位简介，建议补充 60-200 字剧情简介');
      } else if (stripHtml(novel.summary).length < summaryMin) {
        warnings.push('简介偏短，建议补充到 60 字以上以提升点击率');
      }
      if (!novel.cover) warnings.push('缺少封面，书库与推荐位曝光效果会下降');
      if (!novel.seoTitle) patch.seoTitle = title;
      if (!novel.seoDescription && novel.summary) {
        patch.seoDescription = stripHtml(novel.summary).slice(0, 120);
      }
      patch.seoWarnings = warnings;
      return patch;
    },
    'dashboard.afterStats': (payload) => {
      const stats = payload.stats as
        | {
            novels?: { pending?: number; serial?: number };
            chapters?: { today?: number };
            revenue?: { todayCoins?: number; ordersToday?: number };
            authorApplications?: number;
            pendingComments?: number;
          }
        | undefined;
      const insights: { level: 'info' | 'warning'; text: string }[] = [];
      const pendingNovels = stats?.novels?.pending ?? 0;
      const pendingComments = stats?.pendingComments ?? 0;
      const authorApplications = stats?.authorApplications ?? 0;
      const chaptersToday = stats?.chapters?.today ?? 0;
      if (pendingNovels > 0) insights.push({ level: 'warning', text: `有 ${pendingNovels} 本书籍待审核，建议尽快处理` });
      if (authorApplications > 0) insights.push({ level: 'info', text: `有 ${authorApplications} 份作者申请待审核` });
      if (pendingComments > 0) insights.push({ level: 'warning', text: `有 ${pendingComments} 条书评/章评待审核` });
      if (chaptersToday === 0) insights.push({ level: 'info', text: '今日暂无章节更新，建议提醒作者保持更新节奏' });
      if (!insights.length) insights.push({ level: 'info', text: '书籍运营状态良好，继续保持更新与推荐位轮换' });
      return { insights };
    },
  },
};
