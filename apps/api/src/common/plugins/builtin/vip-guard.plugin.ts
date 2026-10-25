import { BUILTIN_PLUGINS, VIP_MIN_PREVIEW_CHARS } from '@wmcms/shared';
import type { BuiltinPluginDefinition } from '../plugin.types';

/**
 * VIP 章节保护
 * - chapter.beforeRender：为「付费且未解锁」的章节生成试读内容（按比例 + 最小字数）
 * - 真正的访问控制在 ChaptersService 中执行：锁定章节的 content 不会返回给前端
 */
export const vipGuardPlugin: BuiltinPluginDefinition = {
  manifest: BUILTIN_PLUGINS.find((p) => p.key === 'vip-guard')!,
  handlers: {
    'chapter.beforeRender': (payload, ctx) => {
      const isVip = Boolean(payload.isVip);
      const unlocked = Boolean(payload.unlocked);
      if (!isVip || unlocked) {
        return { locked: false };
      }
      const content = String(payload.content ?? '');
      const ratio = Number(ctx.config.previewRatio ?? 0.25);
      const minChars = Number(ctx.config.minPreviewChars ?? VIP_MIN_PREVIEW_CHARS);
      const byRatio = Math.floor(content.length * (Number.isFinite(ratio) ? ratio : 0.25));
      const target = Math.max(minChars, Math.min(byRatio, 2000));
      const preview = content.slice(0, target);
      return {
        locked: true,
        preview,
        previewChars: preview.length,
      };
    },
  },
};
