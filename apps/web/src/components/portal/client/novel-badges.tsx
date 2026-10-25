import {
  COMMENT_STATUS_LABELS,
  NOVEL_AUDIT_LABELS,
  NOVEL_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type AuthorStatus,
  type CoinTransactionType,
  type CommentStatus,
  type NovelAuditStatus,
  type NovelStatus,
  type OrderStatus,
} from '@wmcms/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';

type Variant = BadgeProps['variant'];

const ORDER_VARIANTS: Record<OrderStatus, Variant> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'secondary',
};

const COMMENT_VARIANTS: Record<CommentStatus, Variant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

const NOVEL_VARIANTS: Record<NovelStatus, Variant> = {
  serial: 'info',
  completed: 'success',
};

const AUDIT_VARIANTS: Record<NovelAuditStatus, Variant> = {
  pending: 'warning',
  published: 'success',
  rejected: 'destructive',
  offline: 'secondary',
};

const AUTHOR_VARIANTS: Record<AuthorStatus, Variant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
};

const AUTHOR_LABELS: Record<AuthorStatus, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已驳回',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={ORDER_VARIANTS[status] ?? 'secondary'} dot>
      {ORDER_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function CommentStatusBadge({ status }: { status: CommentStatus }) {
  return (
    <Badge variant={COMMENT_VARIANTS[status] ?? 'secondary'} dot>
      {COMMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function NovelStatusBadge({ status }: { status: NovelStatus }) {
  return <Badge variant={NOVEL_VARIANTS[status] ?? 'secondary'}>{NOVEL_STATUS_LABELS[status] ?? status}</Badge>;
}

export function NovelAuditBadge({ status }: { status: NovelAuditStatus }) {
  return (
    <Badge variant={AUDIT_VARIANTS[status] ?? 'secondary'} dot>
      {NOVEL_AUDIT_LABELS[status] ?? status}
    </Badge>
  );
}

export function AuthorStatusBadge({ status }: { status: AuthorStatus }) {
  return (
    <Badge variant={AUTHOR_VARIANTS[status] ?? 'secondary'} dot>
      {AUTHOR_LABELS[status] ?? status}
    </Badge>
  );
}

const TRANSACTION_LABELS: Record<CoinTransactionType, string> = {
  recharge: '充值',
  consume: '消费',
  refund: '退款',
  reward: '奖励',
};

export function TransactionTypeBadge({ type }: { type: CoinTransactionType }) {
  const variant: Variant = type === 'consume' ? 'warning' : type === 'refund' ? 'info' : 'success';
  return <Badge variant={variant}>{TRANSACTION_LABELS[type] ?? type}</Badge>;
}

/** 书币余额 / 充值金额（分 → 元） */
export function formatAmount(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '¥0.00';
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 字数展示 */
export function formatWords(words: number | null | undefined): string {
  if (!words || words <= 0) return '0 字';
  if (words >= 10_000) return `${(words / 10_000).toFixed(1)} 万字`;
  return `${words.toLocaleString('zh-CN')} 字`;
}
