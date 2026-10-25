'use client';

import {
  ORDER_STATUS_LABELS,
  type CoinTransactionType,
  type OrderStatus,
} from '@wmcms/shared';
import { useQuery } from '@tanstack/react-query';
import { Coins, TriangleAlert, Wallet } from 'lucide-react';
import * as React from 'react';
import { CoinTypeBadge, OrderStatusBadge } from '@/components/admin/novel/novel-badges';
import { COIN_TYPE_LABELS, errorText, formatCents } from '@/components/admin/novel/novel-utils';
import { CreditDialog } from '@/components/admin/vip/credit-dialog';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { vipApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn, formatDateTime } from '@/lib/utils';

export default function VipPage() {
  return (
    <PermissionGate permission="vip:view">
      <VipContent />
    </PermissionGate>
  );
}

function VipContent() {
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCredit = hasPermission('vip:credit');

  const [tab, setTab] = React.useState('orders');
  const [creditOpen, setCreditOpen] = React.useState(false);
  const [orderStatus, setOrderStatus] = React.useState<OrderStatus | ''>('');
  const [txType, setTxType] = React.useState<CoinTransactionType | ''>('');
  const [orderPage, setOrderPage] = React.useState(1);
  const [unlockPage, setUnlockPage] = React.useState(1);
  const [txPage, setTxPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);

  const ordersQuery = useQuery({
    queryKey: ['vip-orders', currentSiteId, orderPage, pageSize, orderStatus],
    queryFn: () =>
      vipApi.orders({ page: orderPage, pageSize, status: orderStatus || undefined }),
    enabled: tab === 'orders',
  });

  const unlocksQuery = useQuery({
    queryKey: ['vip-unlocks', currentSiteId, unlockPage, pageSize],
    queryFn: () => vipApi.unlocks({ page: unlockPage, pageSize }),
    enabled: tab === 'unlocks',
  });

  const transactionsQuery = useQuery({
    queryKey: ['vip-transactions', currentSiteId, txPage, pageSize, txType],
    queryFn: () =>
      vipApi.transactions({ page: txPage, pageSize, type: txType || undefined }),
    enabled: tab === 'transactions',
  });

  const orders = ordersQuery.data?.items ?? [];
  const unlocks = unlocksQuery.data?.items ?? [];
  const transactions = transactionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="VIP 与订单"
        description="查看充值订单、章节解锁与书币流水，必要时手动调整会员余额。"
        actions={
          canCredit ? (
            <Button
              size="sm"
              icon={<Coins className="h-4 w-4" />}
              onClick={() => setCreditOpen(true)}
            >
              调整书币
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">充值订单</TabsTrigger>
          <TabsTrigger value="unlocks">解锁记录</TabsTrigger>
          <TabsTrigger value="transactions">书币流水</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-5 space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Select
                value={orderStatus}
                onChange={(event) => {
                  setOrderStatus(event.target.value as OrderStatus | '');
                  setOrderPage(1);
                }}
                aria-label="订单状态筛选"
                className="w-full sm:w-36"
              >
                <option value="">全部状态</option>
                {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {ORDER_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted-foreground sm:ml-auto">
                共 {ordersQuery.data?.total ?? 0} 笔订单
              </span>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            {ordersQuery.isLoading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : ordersQuery.isError ? (
              <EmptyState
                icon={TriangleAlert}
                title="订单加载失败"
                description={errorText(ordersQuery.error)}
                action={
                  <Button variant="outline" size="sm" onClick={() => void ordersQuery.refetch()}>
                    重新加载
                  </Button>
                }
              />
            ) : !orders.length ? (
              <EmptyState
                icon={Wallet}
                title={orderStatus ? '该状态下暂无订单' : '暂无充值订单'}
                description="会员在门户发起充值后会显示在这里。"
              />
            ) : (
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">订单号</TableHead>
                    <TableHead className="w-32">会员</TableHead>
                    <TableHead className="w-24">金额</TableHead>
                    <TableHead className="w-24">书币</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead className="w-24">渠道</TableHead>
                    <TableHead className="w-36">支付时间</TableHead>
                    <TableHead className="w-36">创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="font-mono text-[11px] text-foreground/80">{order.orderNo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {order.member?.nickname ?? order.member?.username ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground/90">{formatCents(order.amountCents)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-primary">{order.coins}</span>
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.channel}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {order.paidAt ? formatDateTime(order.paidAt) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!ordersQuery.isLoading && !ordersQuery.isError && (ordersQuery.data?.total ?? 0) > 0 ? (
              <div className="border-t border-border/70 px-4">
                <Pagination
                  page={orderPage}
                  pageSize={pageSize}
                  total={ordersQuery.data?.total ?? 0}
                  onPageChange={setOrderPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setOrderPage(1);
                  }}
                />
              </div>
            ) : null}
          </Card>
        </TabsContent>

        <TabsContent value="unlocks" className="mt-5">
          <Card className="overflow-hidden">
            {unlocksQuery.isLoading ? (
              <TableSkeleton rows={6} cols={5} />
            ) : unlocksQuery.isError ? (
              <EmptyState
                icon={TriangleAlert}
                title="解锁记录加载失败"
                description={errorText(unlocksQuery.error)}
                action={
                  <Button variant="outline" size="sm" onClick={() => void unlocksQuery.refetch()}>
                    重新加载
                  </Button>
                }
              />
            ) : !unlocks.length ? (
              <EmptyState
                icon={Coins}
                title="暂无解锁记录"
                description="会员付费解锁 VIP 章节后，会在此留下记录。"
              />
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">会员</TableHead>
                    <TableHead className="min-w-[220px]">章节</TableHead>
                    <TableHead className="min-w-[160px]">所属书籍</TableHead>
                    <TableHead className="w-24">消耗书币</TableHead>
                    <TableHead className="w-36">解锁时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unlocks.map((unlock) => (
                    <TableRow key={unlock.id}>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {unlock.member?.username ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-foreground/90">
                          {unlock.chapter ? `第 ${unlock.chapter.chapterNo} 章 ${unlock.chapter.title}` : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {unlock.chapter?.novel?.title ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-warning">{unlock.coins}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{formatDateTime(unlock.createdAt)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!unlocksQuery.isLoading && !unlocksQuery.isError && (unlocksQuery.data?.total ?? 0) > 0 ? (
              <div className="border-t border-border/70 px-4">
                <Pagination
                  page={unlockPage}
                  pageSize={pageSize}
                  total={unlocksQuery.data?.total ?? 0}
                  onPageChange={setUnlockPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setUnlockPage(1);
                  }}
                />
              </div>
            ) : null}
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-5 space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Select
                value={txType}
                onChange={(event) => {
                  setTxType(event.target.value as CoinTransactionType | '');
                  setTxPage(1);
                }}
                aria-label="流水类型筛选"
                className="w-full sm:w-36"
              >
                <option value="">全部类型</option>
                {(Object.keys(COIN_TYPE_LABELS) as CoinTransactionType[]).map((type) => (
                  <option key={type} value={type}>
                    {COIN_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted-foreground sm:ml-auto">
                共 {transactionsQuery.data?.total ?? 0} 条流水
              </span>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            {transactionsQuery.isLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : transactionsQuery.isError ? (
              <EmptyState
                icon={TriangleAlert}
                title="书币流水加载失败"
                description={errorText(transactionsQuery.error)}
                action={
                  <Button variant="outline" size="sm" onClick={() => void transactionsQuery.refetch()}>
                    重新加载
                  </Button>
                }
              />
            ) : !transactions.length ? (
              <EmptyState icon={Coins} title="暂无书币流水" description="充值、消费与手动调整都会记录流水。" />
            ) : (
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">会员</TableHead>
                    <TableHead className="w-24">类型</TableHead>
                    <TableHead className="w-24">变动</TableHead>
                    <TableHead className="w-24">余额</TableHead>
                    <TableHead className="min-w-[200px]">备注</TableHead>
                    <TableHead className="w-36">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {transaction.member?.username ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <CoinTypeBadge type={transaction.type} />
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            transaction.amount >= 0 ? 'text-success' : 'text-destructive',
                          )}
                        >
                          {transaction.amount >= 0 ? '+' : ''}
                          {transaction.amount}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{transaction.balance}</span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {transaction.remark ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(transaction.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!transactionsQuery.isLoading &&
            !transactionsQuery.isError &&
            (transactionsQuery.data?.total ?? 0) > 0 ? (
              <div className="border-t border-border/70 px-4">
                <Pagination
                  page={txPage}
                  pageSize={pageSize}
                  total={transactionsQuery.data?.total ?? 0}
                  onPageChange={setTxPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setTxPage(1);
                  }}
                />
              </div>
            ) : null}
          </Card>
        </TabsContent>
      </Tabs>

      <CreditDialog open={creditOpen} onOpenChange={setCreditOpen} />
    </div>
  );
}
