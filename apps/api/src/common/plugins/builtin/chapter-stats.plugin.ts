import { BUILTIN_PLUGINS } from '@wmcms/shared';
import { estimateReadingTime } from '../../utils/sanitize.util';
import type { BuiltinPluginDefinition } from '../plugin.types';

function countWords(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + latin;
}

/**
 * 章节阅读统计
 * - chapter.beforeRender：产出 wordCount / readingTime（分钟）
 * - chapter.afterPublish：预留钩子（缓存失效、更新提醒）
 */
export const chapterStatsPlugin: BuiltinPluginDefinition = {
  manifest: BUILTIN_PLUGINS.find((p) => p.key === 'chapter-stats')!,
  handlers: {
    'chapter.beforeRender': (payload, ctx) => {
      const content = String(payload.content ?? '');
      const configured = Number(ctx.config.wordsPerMinute ?? 400);
      const wordsPerMinute = Number.isFinite(configured) && configured > 0 ? configured : 400;
      return {
        wordCount: countWords(content),
        readingTime: estimateReadingTime(content, wordsPerMinute),
      };
    },
    'chapter.afterPublish': (payload) => ({
      publishedChapterId: payload.chapterId ?? null,
    }),
  },
};
