export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 为正文 h2/h3 注入锚点 id，并生成目录。
 * 已存在 id 的标题会被复用，避免重复注入。
 */
export function buildTocWithAnchors(
  html: string,
  options: { minLevel?: number; maxLevel?: number; anchorPrefix?: string } = {},
): { html: string; toc: TocItem[] } {
  const minLevel = options.minLevel ?? 2;
  const maxLevel = options.maxLevel ?? 3;
  const prefix = options.anchorPrefix ?? 'sec-';
  const toc: TocItem[] = [];
  let index = 0;

  const replaced = (html ?? '').replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, levelRaw: string, attrs: string, inner: string) => {
      const level = Number(levelRaw);
      if (level < minLevel || level > maxLevel) return match;
      const text = inner.replace(/<[^>]+>/g, '').trim();
      if (!text) return match;
      index += 1;
      const existingId = /\bid=["']([^"']+)["']/i.exec(attrs)?.[1];
      const id = existingId || `${prefix}${index}`;
      toc.push({ id, text, level });
      if (existingId) return match;
      return `<h${level}${attrs} id="${escapeHtml(id)}">${inner}</h${level}>`;
    },
  );

  return { html: replaced, toc };
}
