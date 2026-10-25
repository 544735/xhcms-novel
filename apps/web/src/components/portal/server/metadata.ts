import type { Metadata } from 'next';
import type { ChapterContent, NovelCard, NovelDetail } from '@wmcms/shared';
import { NOVEL_STATUS_LABELS } from '@wmcms/shared';
import { SITE_URL } from '@/lib/server-api';
import { portalUrl } from '@/lib/site';
import type { PortalContext } from '@/themes/types';

/**
 * 小说门户 SEO：站点级默认 metadata + 书籍 / 章节 / 分类 / 作者 / 列表页的 canonical 与 OG。
 * 页面级 generateMetadata 返回 title 字符串，由站点 Layout 的 title.template 拼接为
 * `页面标题 · 站点名`（最外层 root layout 的模板已被站点模板覆盖）。
 */

function splitKeywords(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = value
    .split(/[,，;；|\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function absoluteUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function baseDescription(ctx: PortalContext): string | undefined {
  return ctx.site.seoDescription || ctx.site.description || ctx.settings.heroSubtitle || undefined;
}

function novelKeywords(novel: NovelCard): string[] | undefined {
  return [novel.title, novel.authorName, novel.category?.name, ...(novel.status ? [NOVEL_STATUS_LABELS[novel.status]] : [])].filter(
    (item): item is string => Boolean(item),
  );
}

/** 站点级默认 metadata（Layout 使用） */
export function buildSiteMetadata(ctx: PortalContext): Metadata {
  const { site, settings } = ctx;
  const title = site.seoTitle || site.name;
  const description = baseDescription(ctx);
  const canonical = portalUrl(ctx.basePath);

  return {
    title: {
      default: title,
      template: `%s · ${site.name}`,
    },
    description,
    keywords: splitKeywords(site.seoKeywords),
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      siteName: site.name,
      title,
      description,
      url: canonical,
      images: site.logo ? [{ url: absoluteUrl(site.logo)!, alt: site.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: site.logo ? [absoluteUrl(site.logo)!] : undefined,
    },
    other: settings.icp ? { icp: settings.icp } : undefined,
  };
}

/** 列表页（首页 / 书库 / 分类 / 排行） */
export function buildListMetadata(
  ctx: PortalContext,
  options: { title?: string; description?: string; path?: string; keywords?: string[] },
): Metadata {
  const canonical = portalUrl(ctx.basePath, options.path ?? '');
  const description = options.description || baseDescription(ctx);
  return {
    ...(options.title ? { title: options.title } : {}),
    description,
    keywords: options.keywords ?? splitKeywords(ctx.site.seoKeywords),
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      siteName: ctx.site.name,
      title: options.title ?? ctx.site.seoTitle ?? ctx.site.name,
      description,
      url: canonical,
    },
  };
}

/** 书籍详情：seoTitle/seoKeywords/seoDescription + book OG（封面） */
export function buildBookMetadata(ctx: PortalContext, novel: NovelDetail, path: string): Metadata {
  const siteName = ctx.site.name;
  const rawTitle = novel.seoTitle || `${novel.title} · ${novel.authorName}`;
  // 后端 seoTitle 常已包含站点名（如「星海彼岸最新章节_星河散人_星海书城」），
  // 此时用 absolute 跳过 layout 的 title.template，避免「· 星海书城」重复拼接。
  const title = rawTitle.includes(siteName) ? { absolute: rawTitle } : rawTitle;
  const displayTitle = rawTitle;
  const description =
    novel.seoDescription ||
    novel.summary ||
    `${novel.title}是${novel.authorName}创作的${novel.category?.name ?? '网络小说'}，${NOVEL_STATUS_LABELS[novel.status]}，共 ${novel.chapterCount} 章 ${novel.words} 字。`;
  const canonical = portalUrl(ctx.basePath, path);
  const keywords = splitKeywords(novel.seoKeywords) ?? novelKeywords(novel);
  const image = absoluteUrl(novel.cover);

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: 'book',
      locale: 'zh_CN',
      siteName,
      title: displayTitle,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: novel.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: displayTitle,
      description,
      images: image ? [image] : undefined,
    },
  };
}

/** 阅读页：书名 + 章节名 */
export function buildChapterMetadata(
  ctx: PortalContext,
  chapter: ChapterContent,
  path: string,
): Metadata {
  const title = `${chapter.novelTitle} ${chapter.title}`;
  const description = `${chapter.novelTitle} ${chapter.title}在线阅读${chapter.isVip ? '（VIP 章节）' : ''}。${chapter.novelTitle}最新章节尽在${ctx.site.name}。`;
  const canonical = portalUrl(ctx.basePath, path);
  return {
    title,
    description,
    keywords: [chapter.novelTitle, chapter.title, ctx.site.name],
    alternates: { canonical },
    openGraph: {
      type: 'article',
      locale: 'zh_CN',
      siteName: ctx.site.name,
      title,
      description,
      url: canonical,
    },
  };
}

/** 作者页 */
export function buildAuthorMetadata(
  ctx: PortalContext,
  author: { penName: string; bio: string | null },
  path: string,
): Metadata {
  const title = `${author.penName} 的作品`;
  const description = author.bio || `${author.penName}在${ctx.site.name}创作的全部小说作品。`;
  const canonical = portalUrl(ctx.basePath, path);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      locale: 'zh_CN',
      siteName: ctx.site.name,
      title,
      description,
      url: canonical,
    },
  };
}

/** 搜索等无需收录的页面 */
export function buildNoindexMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true } };
}
