import type { ThemeKey } from './types';

/** 系统内置插件钩子（插件宿主会按此顺序广播） */
export const PLUGIN_HOOKS = {
  'novel.beforeCreate': '创建书籍前（可补全简介、产出 SEO 建议）',
  'chapter.beforeRender': '章节正文渲染前（阅读时长、字数、试读比例）',
  'chapter.afterPublish': '章节发布后（缓存、更新提醒）',
  'comment.beforeCreate': '评论入库前（垃圾评论拦截）',
  'comment.afterCreate': '评论入库后（通知、计数）',
  'public.sitemap': '生成 sitemap 时追加 URL',
  'dashboard.afterStats': '仪表盘统计生成后（附加运营建议）',
  // 兼容旧内容模块（文章）保留的钩子名，小说站不再使用
  'article.beforeCreate': '[兼容] 旧文章创建前',
  'article.afterPublish': '[兼容] 旧文章发布后',
  'article.beforeRender': '[兼容] 旧文章渲染前',
} as const;

export type PluginHook = keyof typeof PLUGIN_HOOKS;

export const PLUGIN_HOOK_NAMES = Object.keys(PLUGIN_HOOKS) as PluginHook[];

export interface BuiltinPluginManifest {
  key: string;
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: PluginHook[];
  defaultConfig: Record<string, unknown>;
}

/** 内置插件清单：种子数据 + 插件宿主运行时实现一一对应 */
export const BUILTIN_PLUGINS: BuiltinPluginManifest[] = [
  {
    key: 'chapter-stats',
    name: '章节阅读统计',
    version: '1.3.0',
    description: '统计章节字数、估算阅读时长，并在书籍详情页展示阅读进度参考。',
    author: 'XHCMS Team',
    hooks: ['chapter.beforeRender', 'chapter.afterPublish'],
    defaultConfig: { wordsPerMinute: 400, countMode: 'mixed' },
  },
  {
    key: 'vip-guard',
    name: 'VIP 章节保护',
    version: '1.1.0',
    description: '为付费章节生成试读内容（按比例截断），并限制未登录用户的批量抓取。',
    author: 'XHCMS Team',
    hooks: ['chapter.beforeRender'],
    defaultConfig: { previewRatio: 0.25, minPreviewChars: 400 },
  },
  {
    key: 'novel-seo',
    name: '书籍 SEO 优化',
    version: '1.4.0',
    description: '为书籍生成 SEO 标题/关键词/简介，检查标题长度与简介完整度，并输出运营建议。',
    author: 'XHCMS Team',
    hooks: ['novel.beforeCreate', 'dashboard.afterStats'],
    defaultConfig: { titleMin: 2, titleMax: 30, summaryMin: 40 },
  },
  {
    key: 'comment-guard',
    name: '评论安全卫士',
    version: '1.0.4',
    description: '拦截含敏感词、超量链接与重复灌水的书评/章评，支持敏感词库配置。',
    author: 'XHCMS Team',
    hooks: ['comment.beforeCreate'],
    defaultConfig: { maxLinks: 2, bannedWords: ['加微信', '代开发票', '博彩'], blockDuplicates: true },
  },
  {
    key: 'sitemap-enhancer',
    name: 'Sitemap 增强',
    version: '1.1.0',
    description: '在站点 sitemap.xml 中追加分类页、排行榜与作者页，提升收录效率。',
    author: 'XHCMS Team',
    hooks: ['public.sitemap'],
    defaultConfig: { includeCategories: true, includeRankings: true, includeAuthors: true },
  },
];

export const BUILTIN_PLUGIN_KEYS = BUILTIN_PLUGINS.map((p) => p.key);

/** 内置主题清单：与 apps/web/src/themes 下的实现一一对应 */
export const THEMES: {
  key: ThemeKey;
  name: string;
  description: string;
  preview: string;
  config: Record<string, unknown>;
}[] = [
  {
    key: 'modern',
    name: '星海夜读 (Modern)',
    description: '深色渐变书封、卡片式书库、沉浸式阅读器，适合现代网文平台。',
    preview: 'gradient-indigo',
    config: { primaryColor: '#6366f1', layout: 'cards', showHero: true, readerTheme: 'dark' },
  },
  {
    key: 'magazine',
    name: '墨香书卷 (Magazine)',
    description: '纸质感底色、衬线刊头、榜单侧栏，适合传统书城与出版物。',
    preview: 'gradient-amber',
    config: { primaryColor: '#b45309', layout: 'magazine', showHero: true, readerTheme: 'sepia' },
  },
  {
    key: 'minimal',
    name: '极简纯读 (Minimal)',
    description: '单栏窄版心、无卡片无广告，专注长章节阅读体验。',
    preview: 'gradient-emerald',
    config: { primaryColor: '#0f766e', layout: 'single', showHero: false, readerTheme: 'light' },
  },
];

export const THEME_KEYS = THEMES.map((t) => t.key);

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

/** 默认站点（门户/后台未显式指定时使用） */
export const DEFAULT_SITE_SLUG = 'books';

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
/**
 * 允许上传的 MIME 白名单。
 * 注意：不含 `image/svg+xml` —— SVG 可内嵌 <script>，而 /uploads 与后台同源静态托管，
 * 直链打开即等于存储型 XSS。如需图标请上传位图或在服务端渲染后再落盘。
 */
export const UPLOAD_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

/* ------------------------------------------------------------------ */
/* VIP / 阅读器                                                         */
/* ------------------------------------------------------------------ */

/** 充值套餐（生产应改为后台可配置；v1 固定套餐） */
export const RECHARGE_PLANS = [
  { id: 'plan-600', label: '600 书币', coins: 600, amountCents: 600, bonusCoins: 0 },
  { id: 'plan-3000', label: '3000 书币', coins: 3000, amountCents: 3000, bonusCoins: 150 },
  { id: 'plan-6800', label: '6800 书币', coins: 6800, amountCents: 6800, bonusCoins: 500 },
  { id: 'plan-12800', label: '12800 书币', coins: 12800, amountCents: 12800, bonusCoins: 1200 },
] as const;

export const CHAPTER_DEFAULT_PRICE = 20;

export const READER_FONT_SIZES = [16, 18, 20, 22, 24, 28] as const;

export const READER_THEMES = [
  { key: 'light', label: '日间', background: '#ffffff', color: '#1f2937' },
  { key: 'sepia', label: '护眼', background: '#f6efe3', color: '#3f3222' },
  { key: 'dark', label: '夜间', background: '#12141a', color: '#c9d1d9' },
  { key: 'green', label: '青瓷', background: '#e7f1e8', color: '#243b2a' },
] as const;

/** 章节锁定时的试读预览最少字数 */
export const VIP_MIN_PREVIEW_CHARS = 400;
