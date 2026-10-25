import sanitizeHtml from 'sanitize-html';

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
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder'],
    '*': ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
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
    iframe: (tagName, attribs) => ({ tagName, attribs }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeContent(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, CONTENT_SANITIZE_OPTIONS);
}

/** 纯文本清洗（昵称、标题等） */
export function sanitizePlainText(input: string | null | undefined, maxLength = 200): string {
  if (!input) return '';
  const cleaned = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLength);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
