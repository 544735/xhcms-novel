import sanitizeHtml from 'sanitize-html';
import { CHAPTER_DEFAULT_PRICE } from '@wmcms/shared';
import { estimateReadingTime } from '../../common/utils/sanitize.util';

/** 默认分章正则：行首「第xx章/节/回」 */
export const DEFAULT_CHAPTER_PATTERN = '^第[一二三四五六七八九十百千0-9]+[章节回]';

/**
 * 章节正文入库前转纯文本：
 * 1. 去 HTML 标签（保留段落换行）；
 * 2. 还原 `&nbsp;` 等实体并压缩连续空白；
 * 3. 去掉行首行尾空白，压缩 3 个以上连续空行。
 */
export function toPlainChapterContent(input: string | null | undefined): string {
  if (!input) return '';
  const normalized = String(input)
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, '\n');
  const plain = sanitizeHtml(normalized, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00a0/g, ' ');
  return plain
    .split('\n')
    .map((line) => line.replace(/[ \t\u3000]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/** 中文字符按字、英文/数字按词统计（与 chapter-stats 插件口径一致） */
export function countChapterWords(text: string | null | undefined): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + latin;
}

export { estimateReadingTime };

/**
 * 统一 VIP 定价：isVip=true 时价格至少 1 书币（未填/非法回落默认 20），
 * 免费章节价格固定为 0，避免出现「VIP 但 0 币」的不一致数据。
 */
export function normalizeChapterPrice(
  isVip: boolean,
  price: number | null | undefined,
): number {
  if (!isVip) return 0;
  const value = Number(price);
  if (!Number.isFinite(value) || value < 1) return CHAPTER_DEFAULT_PRICE;
  return Math.min(Math.floor(value), 100_000);
}

/** 编译分章正则（去掉 g/y 标志避免 test 的 lastIndex 副作用） */
export function compileChapterPattern(input?: string | null): RegExp {
  const source = (input ?? '').trim() || DEFAULT_CHAPTER_PATTERN;
  try {
    return new RegExp(source, 'i');
  } catch {
    throw new Error('分章正则不合法，请检查 pattern');
  }
}

export interface ParsedTxtChapter {
  title: string;
  content: string;
}

/**
 * 按行首标题正则切分 TXT：
 * - 第一个标题之前的内容作为「前言」章节（仅当非空）；
 * - 每个标题之后到下一个标题之前为该章正文；
 * - 全部正文清洗为空时返回空数组，由调用方给出业务错误。
 */
export function splitTxtChapters(text: string, pattern: RegExp): ParsedTxtChapter[] {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const preamble: string[] = [];
  const groups: { title: string; lines: string[] }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && pattern.test(trimmed)) {
      groups.push({ title: trimmed.slice(0, 200), lines: [] });
      continue;
    }
    if (groups.length === 0) preamble.push(line);
    else groups[groups.length - 1].lines.push(line);
  }

  const chapters: ParsedTxtChapter[] = [];
  const preambleText = toPlainChapterContent(preamble.join('\n'));
  if (preambleText) chapters.push({ title: '前言', content: preambleText });

  // 正则按行首匹配，正文中偶然以「第x章」开头的段落会被误判为标题；
  // 对正文为空的分组保留其原始行，合并到下一个（或最后一个）章节，避免丢正文。
  let carry: string[] = [];
  for (const group of groups) {
    const body = toPlainChapterContent(group.lines.join('\n'));
    if (!body) {
      carry.push(group.title);
      continue;
    }
    const content = carry.length ? toPlainChapterContent([...carry, body].join('\n')) : body;
    chapters.push({ title: group.title, content });
    carry = [];
  }
  if (carry.length) {
    const tail = toPlainChapterContent(carry.join('\n'));
    if (tail) {
      if (chapters.length) {
        const last = chapters[chapters.length - 1];
        last.content = toPlainChapterContent(`${last.content}\n${tail}`);
      } else {
        chapters.push({ title: '正文', content: tail });
      }
    }
  }

  if (!chapters.length) {
    const whole = toPlainChapterContent(text);
    if (whole) chapters.push({ title: '正文', content: whole });
  }
  return chapters;
}
