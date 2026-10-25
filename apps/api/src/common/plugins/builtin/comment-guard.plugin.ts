import { BUILTIN_PLUGINS } from '@wmcms/shared';
import type { BuiltinPluginDefinition } from '../plugin.types';

/**
 * 评论安全卫士
 * - 钩子：comment.beforeCreate
 * - 产出：blocked / reason（comments 服务据此拒绝入库）
 */
export const commentGuardPlugin: BuiltinPluginDefinition = {
  manifest: BUILTIN_PLUGINS.find((p) => p.key === 'comment-guard')!,
  handlers: {
    'comment.beforeCreate': (payload, ctx) => {
      const content = String(payload.content ?? '');
      const nickname = String(payload.nickname ?? '');
      const maxLinks = Number(ctx.config.maxLinks ?? 2);
      const bannedWords = Array.isArray(ctx.config.bannedWords)
        ? (ctx.config.bannedWords as string[])
        : ['加微信', '代开发票', '博彩'];

      if (lenientLength(content) < 2) {
        return { blocked: true, reason: '评论内容过短' };
      }
      if (lenientLength(content) > 2000) {
        return { blocked: true, reason: '评论内容过长' };
      }
      const links = content.match(/https?:\/\//gi)?.length ?? 0;
      if (links > maxLinks) {
        return { blocked: true, reason: `评论包含 ${links} 个链接，超过上限 ${maxLinks}` };
      }
      const hit = bannedWords.find((word) => word && content.includes(word));
      if (hit) {
        return { blocked: true, reason: `评论包含敏感词「${hit}」` };
      }
      if (nickname && bannedWords.some((word) => word && nickname.includes(word))) {
        return { blocked: true, reason: '昵称包含敏感词' };
      }
      return { blocked: false };
    },
  },
};

function lenientLength(text: string): number {
  return text.replace(/\s+/g, ' ').trim().length;
}
