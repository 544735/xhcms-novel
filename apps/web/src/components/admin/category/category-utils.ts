import type { CategoryNode } from '@wmcms/shared';

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug.trim());
}

/** 栏目树 → 带缩进深度的扁平选项 */
export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): CategoryOption[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategoryTree(node.children ?? [], depth + 1),
  ]);
}

/** 收集栏目自身及全部后代 ID，编辑父栏目时用于排除自身分支 */
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

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '操作失败，请稍后重试';
}
