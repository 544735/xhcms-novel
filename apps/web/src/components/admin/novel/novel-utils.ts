import {
  NOVEL_AUDIT_LABELS,
  NOVEL_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type AuthorStatus,
  type Category,
  type ChapterStatus,
  type CoinTransactionType,
  type CollectTaskStatus,
  type NovelAuditStatus,
  type NovelStatus,
  type OrderStatus,
} from '@wmcms/shared';
import { formatNumber } from '@/lib/utils';

export type BadgeTone =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'purple';

export const AUDIT_BADGE_TONE: Record<NovelAuditStatus, BadgeTone> = {
  pending: 'warning',
  published: 'success',
  rejected: 'destructive',
  offline: 'secondary',
};

export const NOVEL_STATUS_BADGE_TONE: Record<NovelStatus, BadgeTone> = {
  serial: 'info',
  completed: 'success',
};

export const ORDER_BADGE_TONE: Record<OrderStatus, BadgeTone> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'secondary',
};

export const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  draft: '草稿',
  published: '已发布',
};

export const AUTHOR_STATUS_LABELS: Record<AuthorStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

export const AUTHOR_STATUS_TONE: Record<AuthorStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

export const COLLECT_STATUS_LABELS: Record<CollectTaskStatus, string> = {
  pending: '等待中',
  running: '采集中',
  success: '成功',
  partial: '部分成功',
  failed: '失败',
};

export const COLLECT_STATUS_TONE: Record<CollectTaskStatus, BadgeTone> = {
  pending: 'secondary',
  running: 'info',
  success: 'success',
  partial: 'warning',
  failed: 'destructive',
};

export const COIN_TYPE_LABELS: Record<CoinTransactionType, string> = {
  recharge: '充值',
  consume: '消费',
  refund: '退款',
  reward: '奖励',
};

export const COIN_TYPE_TONE: Record<CoinTransactionType, BadgeTone> = {
  recharge: 'success',
  consume: 'warning',
  refund: 'info',
  reward: 'purple',
};

/** 小说/Slug 合法格式（与后端 DTO 保持一致） */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug.trim());
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '操作失败，请稍后重试';
}

/** 书币展示 */
export function formatCoins(value: number | null | undefined): string {
  return `${formatNumber(value ?? 0)} 书币`;
}

/** 分转元 */
export function formatCents(cents: number | null | undefined): string {
  return `¥${((cents ?? 0) / 100).toFixed(2)}`;
}

/** 从 URL 读取初始筛选值（后台页面由 AuthGuard 在客户端渲染，可安全读取） */
export function readSearchParam(name: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get(name) ?? '';
  } catch {
    return '';
  }
}

export interface FlatCategoryRow {
  category: Category;
  depth: number;
}

/** 扁平分类列表 → 带深度的树形渲染顺序 */
export function flattenCategoryRows(list: Category[]): FlatCategoryRow[] {
  const byParent = new Map<string, Category[]>();
  for (const category of list) {
    const key = category.parentId ?? 'root';
    const bucket = byParent.get(key) ?? [];
    bucket.push(category);
    byParent.set(key, bucket);
  }
  const rows: FlatCategoryRow[] = [];
  const visit = (parentKey: string, depth: number) => {
    for (const category of byParent.get(parentKey) ?? []) {
      rows.push({ category, depth });
      visit(category.id, depth + 1);
    }
  };
  visit('root', 0);
  // 父栏目缺失的孤儿节点兜底展示
  const seen = new Set(rows.map((row) => row.category.id));
  for (const category of list) {
    if (!seen.has(category.id)) rows.push({ category, depth: 0 });
  }
  return rows;
}

/** 分类自身及后代 ID（编辑父分类时排除） */
export function collectCategoryBranchIds(list: Category[], targetId: string): Set<string> {
  const result = new Set<string>();
  const visit = (id: string) => {
    result.add(id);
    for (const category of list) {
      if (category.parentId === id && !result.has(category.id)) visit(category.id);
    }
  };
  visit(targetId);
  return result;
}

/** 统计文本字数（中文按字、英文按词，粗略低估，仅用于编辑提示） */
export function countWords(text: string): number {
  const plain = text.replace(/\s+/g, '');
  return plain.length;
}

export { NOVEL_AUDIT_LABELS, NOVEL_STATUS_LABELS, ORDER_STATUS_LABELS };
