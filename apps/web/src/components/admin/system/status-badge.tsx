import { Badge, type BadgeProps } from '@/components/ui/badge';

type StatusMeta = { label: string; variant: BadgeProps['variant'] };

const STATUS_META: Record<string, StatusMeta> = {
  enabled: { label: '启用', variant: 'success' },
  active: { label: '正常', variant: 'success' },
  disabled: { label: '停用', variant: 'secondary' },

  pending: { label: '待审核', variant: 'warning' },
  approved: { label: '已通过', variant: 'success' },
  rejected: { label: '已拒绝', variant: 'destructive' },

  draft: { label: '草稿', variant: 'secondary' },
  published: { label: '已发布', variant: 'success' },
  scheduled: { label: '定时发布', variant: 'info' },
  archived: { label: '已归档', variant: 'outline' },
};

/** 把后端状态枚举渲染为统一的中文 Badge */
export function StatusBadge({
  status,
  className,
  dot = true,
}: {
  status: string;
  className?: string;
  dot?: boolean;
}) {
  const meta = STATUS_META[status] ?? { label: status || '—', variant: 'secondary' as const };
  return (
    <Badge variant={meta.variant} dot={dot} className={className}>
      {meta.label}
    </Badge>
  );
}
