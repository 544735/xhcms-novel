import type { ArticleStatus, CategoryNode, CategoryType } from '@wmcms/shared';

/** 文章状态 → Badge 变体映射 */
export const ARTICLE_STATUS_BADGE: Record<
  ArticleStatus,
  'secondary' | 'success' | 'warning' | 'outline'
> = {
  draft: 'secondary',
  published: 'success',
  scheduled: 'warning',
  archived: 'outline',
};

/** slug 合法格式：小写字母/数字，单词之间用单个连字符 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug.trim());
}

/** 粗略统计正文字数（去除 HTML 标签与空白） */
export function countContentChars(html: string): number {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim().length;
}

/** 正文是否为空：无文本且不含图片/分隔线/表格等结构元素 */
export function isContentEmpty(html: string): boolean {
  const plain = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, '')
    .trim();
  if (plain.length > 0) return false;
  return !/<(img|hr|figure|table|iframe)\b/i.test(html);
}

/** ISO 时间 → datetime-local 输入值（本地时区） */
export function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** datetime-local 输入值 → ISO 字符串 */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

/** 将栏目树拍平为带缩进深度的选项列表 */
export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): CategoryOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategoryTree(node.children ?? [], depth + 1),
  ]);
}

/** 仅保留指定类型的栏目树（文章选择器只展示 article 类型） */
export function filterCategoryTreeByType(
  nodes: CategoryNode[],
  type: CategoryType,
): CategoryNode[] {
  return nodes
    .filter((node) => node.type === type)
    .map((node) => ({
      ...node,
      children: filterCategoryTreeByType(node.children ?? [], type),
    }));
}

/** 收集栏目自身及全部后代 ID（编辑时排除，避免形成环） */
export function collectCategoryIds(nodes: CategoryNode[], targetId: string): Set<string> {
  const result = new Set<string>();
  const walk = (list: CategoryNode[], inside: boolean) => {
    for (const node of list) {
      const isInside = inside || node.id === targetId;
      if (isInside) result.add(node.id);
      walk(node.children ?? [], isInside);
    }
  };
  walk(nodes, false);
  return result;
}

/** 统一把异常转换成可展示文案 */
export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '操作失败，请稍后重试';
}
