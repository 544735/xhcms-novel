'use client';

import type { RechargeOrder } from '@wmcms/shared';
import { RECHARGE_PLANS } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, CreditCard, Gem, RefreshCw, ShoppingBag, Wallet } from 'lucide-react';
import * as React from 'react';
import { OrderStatusBadge, formatAmount } from '@/components/portal/client/novel-badges';
import { useMemberGuard } from '@/components/portal/member/member-guard';
import { MemberPageFrame } from '@/components/portal/member/member-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { readerApi, ApiError } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/utils';

export interface VipViewProps {
  siteSlug: string;
  basePath: string;
}

/** 充值 VIP：套餐 → 创建订单 → 模拟支付 → 余额刷新 + 订单记录 */
export function VipView({ siteSlug, basePath }: VipViewProps) {
  const queryClient = useQueryClient();
  const { ready, handleAuthError } = useMemberGuard(basePath);

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [creatingPlan, setCreatingPlan] = React.useState<string | null>(null);
  const [payTarget, setPayTarget] = React.useState<RechargeOrder | null>(null);

  const walletQuery = useQuery({
    queryKey: ['member', 'wallet', siteSlug],
    queryFn: () => readerApi.wallet(siteSlug),
    enabled: ready,
  });

  const ordersQuery = useQuery({
    queryKey: ['member', 'orders', siteSlug, page, pageSize],
    queryFn: () => readerApi.orders(siteSlug, page, pageSize),
    enabled: ready,
  });

  React.useEffect(() => {
    for (const error of [walletQuery.error, ordersQuery.error]) {
      if (error && handleAuthError(error)) break;
    }
  }, [walletQuery.error, ordersQuery.error, handleAuthError]);

  const invalidateAccount = () => {
    void queryClient.invalidateQueries({ queryKey: ['member', 'wallet', siteSlug] });
    void queryClient.invalidateQueries({ queryKey: ['member', 'orders', siteSlug] });
    void queryClient.invalidateQueries({ queryKey: ['member', 'transactions', siteSlug] });
  };

  const createMutation = useMutation({
    mutationFn: (planId: string) => readerApi.createOrder(siteSlug, planId),
    onSuccess: (order) => {
      toast.info('订单已创建，请完成模拟支付');
      void queryClient.invalidateQueries({ queryKey: ['member', 'orders', siteSlug] });
      setPayTarget(order);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '创建订单失败，请稍后重试');
    },
    onSettled: () => setCreatingPlan(null),
  });

  const payMutation = useMutation({
    mutationFn: (orderNo: string) => readerApi.payOrder(siteSlug, orderNo),
    onSuccess: (result) => {
      toast.success(`支付成功，已到账 ${formatNumber(result.order.coins)} 书币`, {
        description: `当前余额 ${formatNumber(result.balance)} 书币`,
      });
      invalidateAccount();
      setPayTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '支付失败，请稍后重试');
      setPayTarget(null);
    },
  });

  const wallet = walletQuery.data;
  const orders = ordersQuery.data;

  return (
    <MemberPageFrame
      basePath={basePath}
      title="充值 VIP"
      description="书币用于解锁 VIP 章节；本站为演示环境，支付为模拟支付，点击后立即到账。"
      actions={
        <Button variant="outline" size="sm" onClick={() => void walletQuery.refetch()} disabled={walletQuery.isFetching}>
          <RefreshCw className="h-4 w-4" />
          刷新余额
        </Button>
      }
    >
      <div className="space-y-5">
        {/* 钱包概览 */}
        <Card>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">当前余额</p>
                {walletQuery.isLoading ? (
                  <Skeleton className="mt-1 h-7 w-24" />
                ) : (
                  <p className="text-2xl font-semibold tracking-tight text-foreground">
                    {formatNumber(wallet?.balance ?? 0)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">书币</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success dark:text-emerald-400">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">累计充值</p>
                <p className="text-lg font-semibold text-foreground">{formatNumber(wallet?.totalRecharged ?? 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning dark:text-amber-400">
                <Gem className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">累计消费</p>
                <p className="text-lg font-semibold text-foreground">{formatNumber(wallet?.totalConsumed ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 套餐 */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">选择充值套餐</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {RECHARGE_PLANS.map((plan) => {
              const bonus = plan.bonusCoins ?? 0;
              const total = plan.coins + bonus;
              const creating = creatingPlan === plan.id;
              return (
                <Card key={plan.id} className="relative overflow-hidden">
                  {bonus > 0 ? (
                    <span className="absolute right-0 top-0 rounded-bl-lg bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      送 {bonus}
                    </span>
                  ) : null}
                  <CardHeader className="pb-2">
                    <CardDescription>{plan.label}</CardDescription>
                    <CardTitle className="text-2xl">
                      {formatNumber(total)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">书币</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-lg font-semibold text-foreground">{formatAmount(plan.amountCents)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {bonus > 0 ? `含赠送 ${bonus} 书币 · ` : ''}约 {formatAmount(Math.round(plan.amountCents / total))}/书币
                    </p>
                    <Button
                      className="w-full"
                      size="sm"
                      loading={creating}
                      disabled={createMutation.isPending && !creating}
                      onClick={() => {
                        setCreatingPlan(plan.id);
                        createMutation.mutate(plan.id);
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      立即充值
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 订单记录 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              充值订单
            </CardTitle>
            <CardDescription className="mt-1">待支付订单可点击「模拟支付」立即到账</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready || ordersQuery.isLoading ? (
              <SkeletonText lines={4} />
            ) : ordersQuery.isError ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">订单加载失败，请稍后重试。</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void ordersQuery.refetch()}>
                  重新加载
                </Button>
              </div>
            ) : !orders?.items.length ? (
              <EmptyState
                compact
                icon={ShoppingBag}
                title="还没有充值订单"
                description="选择上方套餐即可创建第一笔订单。"
              />
            ) : (
              <>
                <ul className="divide-y divide-border/70">
                  {orders.items.map((order) => (
                    <li key={order.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{order.orderNo}</p>
                        <p className="mt-0.5 text-xs text-foreground">
                          {formatNumber(order.coins)} 书币 · 实付 {formatAmount(order.amountCents)} ·{' '}
                          {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                      {order.status === 'pending' ? (
                        <Button size="sm" loading={payMutation.isPending} onClick={() => setPayTarget(order)}>
                          模拟支付
                        </Button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {order.paidAt ? `支付于 ${formatDateTime(order.paidAt)}` : '—'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 border-t border-border/70 pt-2">
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={orders.total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          说明：充值金额与书币兑换比例为演示数据；模拟支付不会产生任何真实扣款。VIP 章节解锁后永久有效。
        </p>
      </div>

      <ConfirmDialog
        open={Boolean(payTarget)}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null);
        }}
        title="模拟支付"
        description={
          payTarget
            ? `订单 ${payTarget.orderNo}：${formatNumber(payTarget.coins)} 书币，应付 ${formatAmount(payTarget.amountCents)}。确认后立即到账（演示支付）。`
            : undefined
        }
        confirmText="确认支付"
        destructive={false}
        loading={payMutation.isPending}
        onConfirm={async () => {
          if (!payTarget) return;
          try {
            await payMutation.mutateAsync(payTarget.orderNo);
          } catch {
            /* 错误提示已由 mutation onError 处理 */
          }
        }}
      />
    </MemberPageFrame>
  );
}
