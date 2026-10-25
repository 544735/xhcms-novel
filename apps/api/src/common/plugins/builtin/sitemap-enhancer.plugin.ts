import { BUILTIN_PLUGINS } from '@wmcms/shared';
import type { BuiltinPluginDefinition } from '../plugin.types';

/**
 * Sitemap 增强
 * - public.sitemap
 * - 入参：{ site:{slug}, urls:string[], categories:{slug}[], authors:{penName}[], rankings:boolean }
 * - 产出：urls（追加分类页、排行榜、作者页）
 */
export const sitemapEnhancerPlugin: BuiltinPluginDefinition = {
  manifest: BUILTIN_PLUGINS.find((p) => p.key === 'sitemap-enhancer')!,
  handlers: {
    'public.sitemap': (payload, ctx) => {
      const urls = Array.isArray(payload.urls) ? [...(payload.urls as string[])] : [];
      const includeCategories = ctx.config.includeCategories !== false;
      const includeRankings = ctx.config.includeRankings !== false;
      const includeAuthors = ctx.config.includeAuthors !== false;
      const site = payload.site as { slug?: string } | undefined;
      if (!site?.slug) return { urls };

      if (includeCategories) {
        for (const category of (payload.categories ?? []) as { slug?: string }[]) {
          if (category.slug) urls.push(`/category/${category.slug}`);
        }
      }
      if (includeRankings) urls.push('/rank');
      if (includeAuthors) {
        for (const author of (payload.authors ?? []) as { penName?: string }[]) {
          if (author.penName) urls.push(`/author/${encodeURIComponent(author.penName)}`);
        }
      }
      return { urls: Array.from(new Set(urls)) };
    },
  },
};
