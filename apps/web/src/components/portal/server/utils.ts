import type { PublicCategory } from '@wmcms/shared';

/**
 * 安全还原动态段（作者笔名等可能含中文）。
 * Next 对动态段通常已解码，但个别部署/编码路径下可能仍带 %XX；先尝试解码，
 * 解码失败（或本身是普通字符串）时原样返回，避免二次编码导致后端 404。
 */
export function safeDecodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 在小说分类树（多级）中按 slug 查找分类 */
export function findCategoryBySlug(
  nodes: PublicCategory[],
  slug: string,
): PublicCategory | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const child = findCategoryBySlug(node.children ?? [], slug);
    if (child) return child;
  }
  return null;
}

/** 分类树路径（面包屑）：从一级分类到目标分类；未找到返回 [] */
export function findCategoryPath(nodes: PublicCategory[], slug: string): PublicCategory[] {
  for (const node of nodes) {
    if (node.slug === slug) return [node];
    const childPath = findCategoryPath(node.children ?? [], slug);
    if (childPath.length) return [node, ...childPath];
  }
  return [];
}
