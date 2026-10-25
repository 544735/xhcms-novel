import { BadRequestException } from '@nestjs/common';
import type { CollectSelectors } from '@wmcms/shared';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { sanitizePlainText } from '../../common/utils/sanitize.util';

/** 采集请求超时（毫秒）与响应上限 */
export const COLLECT_FETCH_TIMEOUT_MS = 15_000;
export const COLLECT_MAX_BYTES = 8 * 1024 * 1024;
export const COLLECT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 XHCMS-Collector/1.0';

/* ------------------------------ 选择器 ------------------------------ */

/** 解析数据库中的 selectors JSON 字符串（容错：非法 JSON 视为空对象） */
export function parseSelectors(raw: string | null | undefined): CollectSelectors {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CollectSelectors;
    }
    return {};
  } catch {
    return {};
  }
}

/* ------------------------------ HTTP 抓取 ------------------------------ */

async function readBodyWithEncoding(response: Response): Promise<string> {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > COLLECT_MAX_BYTES) {
    throw new BadRequestException('目标页面体积超过 8MB，已放弃抓取');
  }
  const contentType = response.headers.get('content-type') ?? '';
  const headerCharset = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  let charset = headerCharset;
  if (!charset) {
    // 从 HTML 头部的 <meta charset> 兜底（GBK/GB2312 站点常见）
    const head = buffer.subarray(0, 2048).toString('latin1');
    charset =
      /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ??
      /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i.exec(head)?.[1];
  }
  if (charset && !/^utf-?8$/i.test(charset)) {
    try {
      return iconv.decode(buffer, charset);
    } catch {
      // 未知编码：回退 UTF-8
    }
  }
  return buffer.toString('utf8');
}

/** 仅允许 http/https；显式拒绝云元数据等敏感内网地址（书源地址由管理员配置） */
export function assertFetchableUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException(`书源地址不是合法的 URL：${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('仅支持 http/https 书源地址');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'metadata'
  ) {
    throw new BadRequestException('禁止抓取云实例元数据地址');
  }
  return parsed.toString();
}

/** 抓取远端文本（自动识别 charset，支持 GBK 等） */
export async function fetchText(url: string): Promise<string> {
  const target = assertFetchableUrl(url);
  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        'User-Agent': COLLECT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(COLLECT_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = (error as Error).name === 'TimeoutError' ? '请求超时' : '网络请求失败';
    throw new BadRequestException(`抓取失败：${reason}`);
  }
  if (!response.ok) {
    throw new BadRequestException(`抓取失败：目标返回 HTTP ${response.status}`);
  }
  return readBodyWithEncoding(response);
}

/* ------------------------------ 路径 / URL ------------------------------ */

/** 按点号路径取值：`data.chapters` / `list.0.title`；空路径返回原对象 */
export function getByPath(root: unknown, path: string | null | undefined): unknown {
  if (!path) return root;
  let cursor: unknown = root;
  for (const segment of path.split('.').filter(Boolean)) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      cursor = cursor[index];
    } else if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}

/** 从任意值中取字符串（支持数字/布尔） */
export function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * 把相对地址补全为绝对地址。
 * 优先用 linkPrefix（书源配置的前缀），否则用当前页面 URL 作为 base。
 */
export function absolutizeUrl(href: string, baseUrl: string): string {
  const raw = String(href ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

/* --------------------------- HTML → 纯文本 --------------------------- */

const BLOCK_TAGS = 'p,div,section,article,header,footer,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre,figure';

/**
 * 章节正文转纯文本：去 script/style/iframe 与所有标签，
 * 保留段落换行，合并连续空行（符合采集正文入库要求）。
 */
export function htmlToPlainText(html: string | null | undefined): string {
  const source = html ?? '';
  if (!source.trim()) return '';
  try {
    const $ = load(source, null, false);
    $('script,style,noscript,iframe,svg,form,button').remove();
    $('br').replaceWith('\n');
    $(BLOCK_TAGS).each((_, element) => {
      $(element).append('\n');
    });
    const text = $.root().text();
    return normalizePlainText(text);
  } catch {
    return normalizePlainText(source.replace(/<[^>]+>/g, ' '));
  }
}

/** 合并空白与连续空行 */
export function normalizePlainText(text: string): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/** 中文字符 + 英文单词数（与小说站 wordCount 口径一致） */
export function countWords(text: string | null | undefined): number {
  const input = String(text ?? '');
  if (!input) return 0;
  const cjk = (input.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (input.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + latin;
}

/** 截断纯文本（标题/简介入库用） */
export function pickText(value: unknown, maxLength = 200): string {
  const text = valueToString(value);
  if (!text) return '';
  return sanitizePlainText(text, maxLength);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
