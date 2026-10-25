'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Search, Wallet } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { SearchInput, useDebouncedValue } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { membersApi, vipApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { errorText } from '@/components/admin/novel/novel-utils';

export interface CreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 调整会员书币（正数充值 / 负数扣减），全部变更由后端写入流水 */
export function CreditDialog({ open, onOpenChange }: CreditDialogProps) {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const [keyword, setKeyword] = React.useState('');
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300);
  const [memberId, setMemberId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [remark, setRemark] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setKeyword('');
    setMemberId('');
    setAmount('');
    setRemark('');
    setError(null);
  }, [open]);

  const membersQuery = useQuery({
    queryKey: ['members', 'credit-search', currentSiteId, debouncedKeyword],
    queryFn: () => membersApi.list({ page: 1, pageSize: 20, keyword: debouncedKeyword || undefined }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => vipApi.credit({ memberId, amount: Number(amount), remark: remark.trim() || undefined }),
    onSuccess: async (result) => {
      toast.success(`调整成功，当前余额 ${result.balance} 书币`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vip-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['vip-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => toast.error('调整失败', { description: errorText(error) }),
  });

  const handleSubmit = () => {
    if (!memberId) {
      setError('请先选择会员');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value === 0) {
      setError('请输入非 0 的整数书币数（支持负数扣减）');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  const members = membersQuery.data?.items ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="调整会员书币"
      description="正数增加、负数扣减；后端会校验余额不得为负并写入流水。"
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            取消
          </Button>
          <Button
            size="sm"
            icon={<Wallet className="h-4 w-4" />}
            loading={mutation.isPending}
            onClick={handleSubmit}
          >
            确认调整
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">选择会员</p>
          <SearchInput value={keyword} onChange={setKeyword} placeholder="搜索用户名/昵称…" />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-input bg-card">
            {membersQuery.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !members.length ? (
              <EmptyState compact icon={Search} title="未找到会员" description="尝试其他关键词。" />
            ) : (
              members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setMemberId(member.id);
                    setError(null);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted',
                    memberId === member.id && 'bg-primary/10',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {member.nickname ?? member.username}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        @{member.username}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {memberId === member.id ? '已选择' : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="变动书币" required hint="正数增加，负数扣减" htmlFor="credit-amount">
            <Input
              id="credit-amount"
              type="number"
              step={1}
              value={amount}
              placeholder="如：100 或 -50"
              onChange={(event) => {
                setAmount(event.target.value);
                if (error) setError(null);
              }}
            />
          </Field>
          <Field label="备注" hint="会写入书币流水，建议说明原因" htmlFor="credit-remark">
            <Input
              id="credit-remark"
              value={remark}
              maxLength={100}
              placeholder="如：活动奖励"
              onChange={(event) => setRemark(event.target.value)}
            />
          </Field>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            调整后余额不可为负，否则后端会返回「余额不足」。
          </p>
        )}
      </div>
    </Dialog>
  );
}
