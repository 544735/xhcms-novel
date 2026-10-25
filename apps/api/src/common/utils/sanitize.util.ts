import sanitizeHtml from 'sanitize-html';

/**
 * 允许以 iframe 形式内嵌的站点（精确 hostname 匹配，不做后缀匹配，
 * 避免 `www.youtube.com.evil.example` 这类伪装域通过）。
 */
const ALLOWED_IFRAME_HOSTNAMES = [
  'www.youtube.com',
  'youtube.com',
  'player.bilibili.com',
  'v.qq.com',
];

/**
 * 保留 iframe 时强制注入的 sandbox。
 * 白名单内均为跨域站点：allow-same-origin 只让被嵌页面保留自己的存储/身份，
 * 由于跨域，它无法读写父页面 DOM（同源 iframe 才存在沙箱逃逸风险）。
 */
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-presentation';

/**
 * 非白名单 iframe 的「整段丢弃」占位标签：故意不在 allowedTags 中。
 * sanitize-html 在 disallowedTagsMode='discard' 下会连同内部内容一起丢弃，
 * 配合 text='' 不产生任何残留输出。
 * 注意：不能只依赖删掉 src —— 那会留下一个空的 <iframe> 标签。
 */
const DISCARDED_IFRAME_TAG = 'iframe-rejected';

/** 解析 iframe src：仅接受绝对 http(s) URL，其它（协议相对/相对路径/javascript:/data:）一律不允许 */
function parseIframeSrc(rawSrc: string | undefined): { href: string; hostname: string } | null {
  const src = (rawSrc ?? '').trim();
  if (!src) return null;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return { href: src, hostname: parsed.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * iframe 白名单转换：
 * - 非白名单站点 → 降级为可点击外链（文本即 URL），绝不保留 iframe 标签
 * - 无法解析 / 非 http(s) → 整段丢弃
 * - 白名单站点 → 保留 iframe，并强制 sandbox / referrerpolicy / lazy loading，
 *   用户传入的 class/style 等一律不继承
 */
const transformIframe: sanitizeHtml.Transformer = (tagName, attribs) => {
  const parsed = parseIframeSrc(attribs.src);
  // 用单个 Tag 变量承载三种结果：多 return 的联合字面量类型在 TS 下无法赋给 Tag
  let result: sanitizeHtml.Tag;
  if (!parsed) {
    // 无 src / 无法解析 / 非 http(s)（含 `//evil.example`、javascript:、data:）→ 整段丢弃
    result = { tagName: DISCARDED_IFRAME_TAG, attribs: {}, text: '' };
  } else if (!ALLOWED_IFRAME_HOSTNAMES.includes(parsed.hostname)) {
    // 非白名单站点：绝不以 iframe 形式输出，降级为一个可点击的外链
    result = {
      tagName: 'a',
      attribs: {
        href: parsed.href,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
      text: parsed.href,
    };
  } else {
    const safe: sanitizeHtml.Attributes = {
      src: parsed.href,
      sandbox: IFRAME_SANDBOX,
      referrerpolicy: 'no-referrer',
      loading: 'lazy',
      frameborder: '0',
      allowfullscreen: 'true',
    };
    if (attribs.width) safe.width = attribs.width;
    if (attribs.height) safe.height = attribs.height;
    if (attribs.allow) safe.allow = attribs.allow;
    result = { tagName, attribs: safe };
  }
  return result;
};

/** 富文本白名单清洗（文章/栏目/评论入库前必须调用） */
export const CONTENT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'span', 'div', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: [
      'src', 'width', 'height', 'allowfullscreen', 'frameborder',
      // 下面几项由 transformTags.iframe 强制写入，必须同时在白名单里才会被输出
      'sandbox', 'referrerpolicy', 'loading', 'allow',
    ],
    '*': ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // 阻断 `//evil.example/x` 这类协议相对 URL
  allowProtocolRelative: false,
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb/],
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      'font-weight': [/^\d+$/],
    },
  },
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: attribs.target === '_self' ? '_self' : '_blank',
      },
    }),
    iframe: transformIframe,
  },
  disallowedTagsMode: 'discard',
};

// 纵深防御：noscript/meta 不在 allowlist 内，但 sanitize-html 2.17 存在
// 「noscript 丢弃区提前结束 / meta refresh 携带 javascript:」两条 moderate advisory，
// 这里先整段剥离，再走白名单清洗。
const DANGEROUS_BLOCKS = /<(noscript|meta)\b[^>]*>[\s\S]*?<\/\1\s*>|<meta\b[^>]*>/gi;

export function sanitizeContent(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(String(html).replace(DANGEROUS_BLOCKS, ''), CONTENT_SANITIZE_OPTIONS);
}

/** 常见 HTML 实体 → 字符（单次扫描，避免 `&amp;lt;` 被反复解码成 `<`） */
const PLAIN_TEXT_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  '#x27': "'",
  nbsp: ' ',
};

function decodePlainTextEntities(input: string): string {
  return input.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/gi, (match, name: string) => {
    return PLAIN_TEXT_ENTITIES[name.toLowerCase()] ?? match;
  });
}

/**
 * 去掉标签（用空格替换，避免 `<p>a</p><p>b</p>` 粘成 `ab`）。
 * script/style 会连同内部文本一起删除——只去标签会把 `alert(1)` 之类残留为正文。
 */
function stripTags(input: string): string {
  return String(input ?? '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

/**
 * 纯文本清洗（昵称、标题、标签名等）。
 *
 * 不走 sanitize-html —— 它会把文本节点里的 `&` / `<` / `>` 重新编码成
 * `&amp;` / `&lt;` / `&gt;` 再入库，导致「Q&A」被存成「Q&amp;A」并在页面二次转义。
 *
 * 安全前提：返回值只允许作为文本节点渲染（React 文本插值 / textContent），
 * 严禁拼进 HTML 字符串或 dangerouslySetInnerHTML。
 */
export function sanitizePlainText(input: string | null | undefined, maxLength = 200): string {
  if (!input) return '';
  const cleaned = decodePlainTextEntities(stripTags(input))
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLength);
}

/** 取纯文本（阅读时长统计、摘要提取等），同样不残留 HTML 实体 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return decodePlainTextEntities(stripTags(html))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 多行纯文本清洗（表单 textarea 提交值等）。
 *
 * 与 sanitizePlainText 的唯一区别：保留换行，不把整段折叠成一行。
 * 顺序：去标签 → 解实体 → CRLF 归一 → 逐行 trim → 连续空行压缩为 1 个空行 → 首尾 trim → 截断。
 *
 * 安全前提同 sanitizePlainText：结果只允许作文本节点渲染，禁止拼进 HTML。
 */
export function sanitizeMultilineText(input: string | null | undefined, maxLength = 2000): string {
  if (!input) return '';
  return decodePlainTextEntities(stripTags(input))
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** 中文按字计、英文按词计，估算阅读时长（分钟，向上取整，最少 1） */
export function estimateReadingTime(html: string | null | undefined, wordsPerMinute = 350): number {
  const text = stripHtml(html);
  if (!text) return 1;
  const cjkChars = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latinWords = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  const minutes = cjkChars / (wordsPerMinute * 0.9) + latinWords / 220;
  return Math.max(1, Math.ceil(minutes));
}

export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
