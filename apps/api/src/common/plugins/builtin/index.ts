import type { BuiltinPluginDefinition } from '../plugin.types';
import { chapterStatsPlugin } from './chapter-stats.plugin';
import { commentGuardPlugin } from './comment-guard.plugin';
import { novelSeoPlugin } from './novel-seo.plugin';
import { sitemapEnhancerPlugin } from './sitemap-enhancer.plugin';
import { vipGuardPlugin } from './vip-guard.plugin';

/** 内置插件实现清单（顺序即同一钩子的执行顺序） */
export const BUILTIN_PLUGIN_DEFINITIONS: BuiltinPluginDefinition[] = [
  novelSeoPlugin,
  vipGuardPlugin,
  chapterStatsPlugin,
  commentGuardPlugin,
  sitemapEnhancerPlugin,
];
