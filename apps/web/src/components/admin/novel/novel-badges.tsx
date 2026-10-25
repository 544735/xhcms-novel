import {
  NOVEL_AUDIT_LABELS,
  NOVEL_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  type AuthorStatus,
  type ChapterStatus,
  type CoinTransactionType,
  type CollectTaskStatus,
  type NovelAuditStatus,
  type NovelStatus,
  type OrderStatus,
} from '@wmcms/shared';
import { Badge } from '@/components/ui/badge';
import {
  AUTHOR_STATUS_LABELS,
  AUTHOR_STATUS_TONE,
  AUDIT_BADGE_TONE,
  CHAPTER_STATUS_LABELS,
  COIN_TYPE_LABELS,
  COIN_TYPE_TONE,
  COLLECT_STATUS_LABELS,
  COLLECT_STATUS_TONE,
  NOVEL_STATUS_BADGE_TONE,
  ORDER_BADGE_TONE,
} from './novel-utils';

export function NovelAuditBadge({ status }: { status: NovelAuditStatus }) {
  return (
    <Badge variant={AUDIT_BADGE_TONE[status]} dot>
      {NOVEL_AUDIT_LABELS[status]}
    </Badge>
  );
}

export function NovelStatusBadge({ status }: { status: NovelStatus }) {
  return <Badge variant={NOVEL_STATUS_BADGE_TONE[status]}>{NOVEL_STATUS_LABELS[status]}</Badge>;
}

export function ChapterStatusBadge({ status }: { status: ChapterStatus }) {
  return (
    <Badge variant={status === 'published' ? 'success' : 'secondary'} dot>
      {CHAPTER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={ORDER_BADGE_TONE[status]} dot>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function AuthorStatusBadge({ status }: { status: AuthorStatus }) {
  return (
    <Badge variant={AUTHOR_STATUS_TONE[status]} dot>
      {AUTHOR_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CollectStatusBadge({ status }: { status: CollectTaskStatus }) {
  return (
    <Badge variant={COLLECT_STATUS_TONE[status]} dot>
      {COLLECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CoinTypeBadge({ type }: { type: CoinTransactionType }) {
  return <Badge variant={COIN_TYPE_TONE[type]}>{COIN_TYPE_LABELS[type]}</Badge>;
}
