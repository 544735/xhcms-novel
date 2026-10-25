import { BadRequestException } from '@nestjs/common';
import type { CollectSelectors } from '@wmcms/shared';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { sanitizePlainText } from '../../common/utils/sanitize.util';

/** 采集请求超时（毫秒）与响应上限 */
export const COLLECT_FETCH_TIMEOUT_MS = 15_000;
export const COLLECT_MAX_BYTES = 8 * 1024 * 1024;
/** 最多跟随的重定向跳数（每一跳都要重新校验目标地址） */
export const COLLECT_MAX_REDIRECTS = 3;
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

/* --------------------------- 目标地址校验 --------------------------- */

/** 直接禁止的主机名（含云元数据服务别名） */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

/** 内网地址统一提示，避免把内部拓扑回显给调用方 */
const BLOCKED_TARGET_MESSAGE = '禁止抓取内网或保留地址';

/**
 * 本地/测试环境与显式开关下放行内网地址：
 * e2e 与 dev 采集依赖本地 HTTP fixture（如 http://127.0.0.1:4000 的演示书源）。
 * 生产（NODE_ENV=production）默认拦截，除非显式设置 COLLECT_ALLOW_PRIVATE_HOSTS=1。
 */
function allowPrivateHosts(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.COLLECT_ALLOW_PRIVATE_HOSTS === '1';
}

/** 主机名归一化：去 IPv6 方括号、去域名末尾根点（FQDN 写法）、转小写 */
function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

function ipv4ToOctets(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return octets;
}

/** 127/8、10/8、172.16/12、192.168/16、169.254/16、0/8；无法识别一律按禁止处理（fail closed） */
function isBlockedIpv4(ip: string): boolean {
  const octets = ipv4ToOctets(ip);
  if (!octets) return true;
  const [first, second] = octets;
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
}

function toHextets(groups: string[]): number[] | null {
  const hextets: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    hextets.push(Number.parseInt(group, 16));
  }
  return hextets.length === 8 ? hextets : null;
}

/** 展开 IPv6（支持 `::` 压缩写法）为 8 组 16 位整数 */
function expandIpv6(ip: string): number[] | null {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  if (halves.length === 1) return toHextets(head);
  const tail = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return toHextets([...head, ...Array<string>(missing).fill('0'), ...tail]);
}

/** 提取 IPv4-mapped IPv6（::ffff:a.b.c.d / ::ffff:7f00:1 等）内嵌的 IPv4 地址 */
function mappedIpv4(ip: string): string | null {
  const normalized = ip.toLowerCase();
  const dotted = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (dotted) return dotted.slice(1, 5).join('.');
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (hex) {
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
  }
  // 其他内嵌点分 IPv4 的写法（如 0:0:0:0:0:ffff:127.0.0.1）
  if (normalized.includes('.')) {
    const candidate = normalized.slice(normalized.lastIndexOf(':') + 1);
    if (ipv4ToOctets(candidate)) return candidate;
  }
  return null;
}

/** IPv4-mapped、::1、::、fc00::/7、fe80::/10；无法解析一律按禁止处理（fail closed） */
function isBlockedIpv6(ip: string): boolean {
  const mapped = mappedIpv4(ip);
  if (mapped) return isBlockedIpv4(mapped);
  const hextets = expandIpv6(ip);
  if (!hextets) return true;
  // ::1（回环）与 ::（未指定地址）
  if (hextets.every((value, index) => (index === 7 ? value <= 1 : value === 0))) return true;
  const first = hextets[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 唯一本地地址
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 链路本地地址
  return false;
}

/**
 * 拒绝指向内网 / 保留地址的抓取目标（SSRF 收口）。
 * 主机名是 IP 字面量时直接判定；是域名时解析出全部地址后逐个判定。
 */
async function assertNoPrivateHost(target: URL): Promise<void> {
  if (allowPrivateHosts()) return;

  const host = normalizeHostname(target.hostname);
  if (!host) throw new BadRequestException('书源地址缺少主机名');
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) {
    throw new BadRequestException(BLOCKED_TARGET_MESSAGE);
  }

  const literalFamily = isIP(host);
  if (literalFamily === 4) {
    if (isBlockedIpv4(host)) throw new BadRequestException(BLOCKED_TARGET_MESSAGE);
    return;
  }
  if (literalFamily === 6) {
    if (isBlockedIpv6(host)) throw new BadRequestException(BLOCKED_TARGET_MESSAGE);
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new BadRequestException(`无法解析书源域名：${host}`);
  }
  if (!addresses.length) throw new BadRequestException(`无法解析书源域名：${host}`);
  for (const entry of addresses) {
    const blocked =
      entry.family === 6 ? isBlockedIpv6(entry.address) : isBlockedIpv4(entry.address);
    if (blocked) throw new BadRequestException(BLOCKED_TARGET_MESSAGE);
  }
}

/* ------------------------------ HTTP 抓取 ------------------------------ */

async function readBodyWithEncoding(response: Response): Promise<string> {
  // 先看声明长度，避免目标用超大响应把进程内存打满
  const declaredLength = Number(response.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declaredLength) && declaredLength > COLLECT_MAX_BYTES) {
    throw new BadRequestException('目标页面体积超过 8MB，已放弃抓取');
  }
  if (!response.body) throw new BadRequestException('抓取失败：目标未返回内容');

  // 流式累计读取：超限立即中断，不把整个 body 先读进内存
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk as Uint8Array);
      total += bytes.length;
      if (total > COLLECT_MAX_BYTES) {
        throw new BadRequestException('目标页面体积超过 8MB，已放弃抓取');
      }
      chunks.push(bytes);
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('抓取失败：目标响应读取中断');
  }

  const buffer = Buffer.concat(chunks, total);
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

/**
 * 抓取入口的地址解析：协议白名单 + 内网/保留地址拦截。
 * 每次抓取（含每一跳重定向）都必须重新调用。
 */
export async function resolveFetchTarget(url: string): Promise<string> {
  const target = new URL(assertFetchableUrl(url));
  await assertNoPrivateHost(target);
  return target.toString();
}

/** 抓取远端文本（自动识别 charset，支持 GBK 等；手工跟跳并逐跳校验目标地址） */
export async function fetchText(url: string): Promise<string> {
  let target = await resolveFetchTarget(url);
  let response: Response | null = null;

  for (let hop = 0; ; hop += 1) {
    try {
      response = await fetch(target, {
        headers: {
          'User-Agent': COLLECT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        // 手工处理重定向：每一跳都要重新做协议 + 内网地址校验
        redirect: 'manual',
        signal: AbortSignal.timeout(COLLECT_FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = (error as Error).name === 'TimeoutError' ? '请求超时' : '网络请求失败';
      throw new BadRequestException(`抓取失败：${reason}`);
    }

    const isRedirect = response.status >= 300 && response.status <= 399;
    if (!isRedirect) break;

    const location = response.headers.get('location');
    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        // 丢弃重定向响应体失败不影响后续流程
      }
    }
    if (!location) {
      throw new BadRequestException(`抓取失败：目标返回 HTTP ${response.status}（缺少 Location）`);
    }
    if (hop >= COLLECT_MAX_REDIRECTS) {
      throw new BadRequestException(`抓取失败：重定向次数超过 ${COLLECT_MAX_REDIRECTS} 次`);
    }
    let nextUrl: string;
    try {
      nextUrl = new URL(location, target).toString();
    } catch {
      throw new BadRequestException('抓取失败：重定向目标地址不合法');
    }
    target = await resolveFetchTarget(nextUrl);
  }

  if (!response) throw new BadRequestException('抓取失败：网络请求失败');
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
