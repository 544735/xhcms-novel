import { BadRequestException } from '@nestjs/common';
import type { CollectSelectors } from '@wmcms/shared';
import { load } from 'cheerio';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import {
  absolutizeUrl,
  countWords,
  fetchText,
  getByPath,
  htmlToPlainText,
  normalizePlainText,
  pickText,
  valueToString,
} from './collect.utils';

/** 解析所需的书源上下文 */
export interface SourceContext {
  type: 'html' | 'json';
  baseUrl: string;
  listUrl: string | null;
  selectors: CollectSelectors;
}

/** 大纲章节：html 模式带 url（进入章节页抓正文），json 模式直接带 content */
export interface OutlineChapter {
  title: string;
  url: string | null;
  content: string | null;
}

export interface ParsedBook {
  title: string;
  author: string;
  cover: string | null;
  summary: string;
  chapters: OutlineChapter[];
}

export interface ParsedChapter {
  title: string;
  content: string;
  wordCount: number;
}

const FALLBACK_BOOK_TITLE = '未命名书籍';
const FALLBACK_AUTHOR = '采集';

/** 书籍页 URL：显式 bookUrl 优先，其次 json 的 listUrl，最后 baseUrl */
export function resolveBookUrl(source: SourceContext, bookUrl?: string): string {
  const explicit = bookUrl?.trim();
  if (explicit) return explicit;
  if (source.type === 'json' && source.listUrl) return source.listUrl;
  return source.baseUrl;
}

/** 抓取并解析书籍页大纲（不落库，不抓章节正文） */
export async function parseBookOutline(
  source: SourceContext,
  bookUrl?: string,
): Promise<ParsedBook> {
  const target = resolveBookUrl(source, bookUrl);
  if (!target) throw new BadRequestException('书源缺少可抓取的书籍页地址');
  if (source.type === 'json') return parseJsonBook(target, source);
  return parseHtmlBook(target, source);
}

/** 抓取单个章节正文 */
export async function parseChapterContent(
  source: SourceContext,
  chapter: OutlineChapter,
): Promise<ParsedChapter> {
  if (source.type === 'json') {
    const content = normalizePlainText(htmlToPlainText(chapter.content ?? ''));
    if (!content) throw new BadRequestException('章节正文为空');
    return { title: chapter.title, content, wordCount: countWords(content) };
  }

  if (!chapter.url) throw new BadRequestException('章节缺少详情页链接');
  const html = await fetchText(chapter.url);
  const $ = load(html);

  const selectorTitle = source.selectors.chapterTitle
    ? sanitizePlainText($(source.selectors.chapterTitle).first().text(), 120)
    : '';
  const title = selectorTitle || chapter.title || '未命名章节';

  const contentSelector = source.selectors.chapterContent;
  if (!contentSelector) throw new BadRequestException('书源缺少章节正文选择器 chapterContent');
  const container = $(contentSelector).first();
  const raw = container.length ? (container.html() ?? '') : '';
  const content = normalizePlainText(htmlToPlainText(raw));
  if (!content) throw new BadRequestException('章节正文为空');
  return { title, content, wordCount: countWords(content) };
}

/* ------------------------------- HTML ------------------------------- */

async function parseHtmlBook(target: string, source: SourceContext): Promise<ParsedBook> {
  const html = await fetchText(target);
  const $ = load(html);
  const selectors = source.selectors;

  const title =
    (selectors.bookTitle ? sanitizePlainText($(selectors.bookTitle).first().text(), 200) : '') ||
    sanitizePlainText($('title').first().text(), 200) ||
    FALLBACK_BOOK_TITLE;
  const author =
    (selectors.bookAuthor ? sanitizePlainText($(selectors.bookAuthor).first().text(), 120) : '') ||
    FALLBACK_AUTHOR;
  const summary = selectors.bookSummary
    ? sanitizePlainText($(selectors.bookSummary).first().text(), 500)
    : '';

  let cover: string | null = null;
  if (selectors.bookCover) {
    const node = $(selectors.bookCover).first();
    const rawCover =
      node.attr('src') ?? node.attr('data-src') ?? node.attr('data-original') ?? null;
    if (rawCover) {
      cover = absolutizeUrl(rawCover, selectors.linkPrefix || target);
    }
  }

  const chapters: OutlineChapter[] = [];
  if (selectors.chapterLinks) {
    const seen = new Set<string>();
    $(selectors.chapterLinks).each((index, element) => {
      const node = $(element);
      const href = (node.attr('href') ?? '').trim();
      if (!href || href.startsWith('javascript:') || href === '#') return;
      const url = absolutizeUrl(href, selectors.linkPrefix || target);
      if (!url || seen.has(url)) return;
      seen.add(url);
      const text =
        sanitizePlainText(node.text(), 120) ||
        sanitizePlainText(node.attr('title') ?? '', 120) ||
        `第 ${index + 1} 章`;
      chapters.push({ title: text, url, content: null });
    });
  } else {
    throw new BadRequestException('HTML 书源缺少章节链接选择器 chapterLinks');
  }

  return { title, author, cover, summary, chapters };
}

/* -------------------------------- JSON -------------------------------- */

async function parseJsonBook(target: string, source: SourceContext): Promise<ParsedBook> {
  const text = await fetchText(target);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BadRequestException('JSON 书源返回内容不是合法 JSON');
  }

  const selectors = source.selectors;
  const bookNode = getByPath(data, selectors.listPath) ?? data;

  const title =
    pickText(getByPath(bookNode, selectors.bookTitle) ?? getByPath(bookNode, 'title'), 200) ||
    FALLBACK_BOOK_TITLE;
  const author =
    pickText(getByPath(bookNode, selectors.bookAuthor) ?? getByPath(bookNode, 'author'), 120) ||
    FALLBACK_AUTHOR;
  const summary = pickText(
    getByPath(bookNode, selectors.bookSummary) ?? getByPath(bookNode, 'summary'),
    500,
  );
  const coverRaw = valueToString(
    getByPath(bookNode, selectors.bookCover) ?? getByPath(bookNode, 'cover'),
  ).trim();
  const cover = coverRaw ? absolutizeUrl(coverRaw, target) : null;

  const itemsNode = getByPath(data, selectors.itemsPath);
  const items = Array.isArray(itemsNode) ? itemsNode : Array.isArray(data) ? data : [];

  const titlePath = selectors.titlePath ?? 'title';
  const contentPath = selectors.contentPath ?? 'content';
  const chapters: OutlineChapter[] = items
    .map((item, index) => {
      const itemTitle = pickText(getByPath(item, titlePath), 120) || `第 ${index + 1} 章`;
      const rawContent = getByPath(item, contentPath);
      const content = normalizePlainText(valueToString(rawContent));
      return { title: itemTitle, url: null, content: content || null };
    })
    .filter((chapter) => Boolean(chapter.title));

  return { title, author, cover, summary, chapters };
}
