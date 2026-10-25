'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Coins,
  LogOut,
  MessageSquare,
  ShoppingBag,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useMemberGuard } from '@/components/portal/member/member-guard';
import { MemberPageFrame } from '@/components/portal/member/member-nav';
import { memberClient } from '@/components/portal/client/member-client';
import {
  CommentStatusBadge,
  OrderStatusBadge,
  TransactionTypeBadge,
  formatAmount,
} from '@/components/portal/client/novel-badges';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { readerApi } from '@/lib/api';
import { tokenStorage } from '@/lib/tokens';
import { formatDateTime, formatNumber, formatRelative, truncate } from '@/lib/utils';

function MemberCenterSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex items-center gap-4 p-5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <SkeletonText lines={2} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-32" />
            <SkeletonText lines={2} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-5 w-28" />
              <SkeletonText lines={4} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export interface MemberCenterViewProps {
  siteSlug: string;
  basePath: string;
  siteName?: string;
}

/** 会员中心：资料 / 钱包 / 订单 / 书币流水 / 我的书评 / 退出登录 */
export function MemberCenterView({ siteSlug, basePath }: MemberCenterViewProps) {
  const router = useRouter();
  const { ready, handleAuthError } = useMemberGuard(basePath);

  const profileQuery = useQuery({
    queryKey: ['member', 'profile', siteSlug],
    queryFn: () => memberClient.profile(siteSlug),
    enabled: ready,
  });
  const walletQuery = useQuery({
    queryKey: ['member', 'wallet', siteSlug],
    queryFn: () => readerApi.wallet(siteSlug),
    enabled: ready,
  });
  const ordersQuery = useQuery({
    queryKey: ['member', 'orders', siteSlug, 1],
    queryFn: () => readerApi.orders(siteSlug, 1, 5),
    enabled: ready,
  });
  const transactionsQuery = useQuery({
    queryKey: ['member', 'transactions', siteSlug, 1],
    queryFn: () => readerApi.transactions(siteSlug, 1, 5),
    enabled: ready,
  });
  const commentsQuery = useQuery({
    queryKey: ['member', 'my-comments', siteSlug, 1],
    queryFn: () => memberClient.myComments(siteSlug, 1, 5),
    enabled: ready,
  });

  React.useEffect(() => {
    const candidates = [
      profileQuery.error,
      walletQuery.error,
      ordersQuery.error,
      transactionsQuery.error,
      commentsQuery.error,
    ];
    for (const error of candidates) {
      if (error && handleAuthError(error)) break;
    }
  }, [
    profileQuery.error,
    walletQuery.error,
    ordersQuery.error,
    transactionsQuery.error,
    commentsQuery.error,
    handleAuthError,
  ]);

  const handleLogout = () => {
    tokenStorage.setMemberToken(null);
    toast.success('已退出会员登录');
    router.push(basePath || '/');
    router.refresh();
  };

  const profile = profileQuery.data;
  const wallet = walletQuery.data;
  const orders = ordersQuery.data;
  const transactions = transactionsQuery.data;
  const myComments = commentsQuery.data;

  return (
    <MemberPageFrame
      basePath={basePath}
      title="会员中心"
      description="查看账号资料、书币余额与最近的消费记录。"
      actions={
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          退出登录
        </Button>
      }
    >
      {!ready || (profileQuery.isLoading && !profile) ? (
        <MemberCenterSkeleton />
      ) : profileQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              会员资料加载失败，请稍后重试。
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void profileQuery.refetch()}>
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : profile ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 资料卡 */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    账号资料
                  </CardTitle>
                  <CardDescription className="mt-1">会员资料仅用于站点内评论、书架与购买记录</CardDescription>
                </div>
                <Badge variant="info">会员</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar size="lg" src={profile.avatar} name={profile.nickname ?? profile.username} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold text-foreground">
                      {profile.nickname ?? profile.username}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">@{profile.username}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary" className="font-normal">
                        {profile.email}
                      </Badge>
                      <Badge variant="purple" className="font-normal">
                        {formatNumber(profile.points)} 积分
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        注册于 {formatDateTime(profile.createdAt)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 钱包卡 */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    我的钱包
                  </CardTitle>
                  <CardDescription className="mt-1">书币用于解锁 VIP 章节</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {walletQuery.isLoading ? (
                  <Skeleton className="h-10 w-28" />
                ) : walletQuery.isError ? (
                  <p className="text-xs text-muted-foreground">钱包信息加载失败</p>
                ) : (
                  <>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-semibold tracking-tight text-foreground">
                        {formatNumber(wallet?.balance ?? 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">书币</span>
                    </p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="flex items-center justify-between gap-2">
                        <span>累计充值</span>
                        <span className="font-medium text-foreground">{formatNumber(wallet?.totalRecharged ?? 0)}</span>
                      </p>
                      <p className="flex items-center justify-between gap-2">
                        <span>累计消费</span>
                        <span className="font-medium text-foreground">{formatNumber(wallet?.totalConsumed ?? 0)}</span>
                      </p>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => router.push(`${basePath}/vip`)}>
                      <Coins className="h-3.5 w-3.5" />
                      充值书币
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 订单 */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    充值订单
                  </CardTitle>
                  <CardDescription className="mt-1">最近 5 笔充值记录</CardDescription>
                </div>
                <Link
                  href={`${basePath}/vip`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  去充值
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent>
                {ordersQuery.isLoading ? (
                  <SkeletonText lines={4} />
                ) : ordersQuery.isError ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">订单加载失败</p>
                ) : !orders?.items.length ? (
                  <EmptyState
                    compact
                    icon={ShoppingBag}
                    title="还没有充值订单"
                    description="充值后可解锁更多 VIP 章节。"
                    action={
                      <Button size="sm" variant="outline" onClick={() => router.push(`${basePath}/vip`)}>
                        选择充值套餐
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {orders.items.map((order) => (
                      <li key={order.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{order.orderNo}</p>
                          <p className="mt-0.5 text-xs text-foreground">
                            {formatNumber(order.coins)} 书币 · 实付 {formatAmount(order.amountCents)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <OrderStatusBadge status={order.status} />
                          <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* 书币流水 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  书币流水
                </CardTitle>
                <CardDescription className="mt-1">最近 5 条账户变动</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsQuery.isLoading ? (
                  <SkeletonText lines={4} />
                ) : transactionsQuery.isError ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">流水加载失败</p>
                ) : !transactions?.items.length ? (
                  <EmptyState compact icon={Coins} title="暂无书币变动" description="充值或消费后会记录在这里。" />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {transactions.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <TransactionTypeBadge type={item.type} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs text-foreground/85">{item.remark || '书币变动'}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={
                              item.amount >= 0
                                ? 'text-sm font-semibold text-success dark:text-emerald-400'
                                : 'text-sm font-semibold text-destructive'
                            }
                          >
                            {item.amount >= 0 ? '+' : ''}
                            {formatNumber(item.amount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">余额 {formatNumber(item.balance)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 我的书评 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                我的书评
              </CardTitle>
              <CardDescription className="mt-1">最近 5 条书评 / 章评，审核通过后公开展示</CardDescription>
            </CardHeader>
            <CardContent>
              {commentsQuery.isLoading ? (
                <SkeletonText lines={3} />
              ) : commentsQuery.isError ? (
                <p className="py-6 text-center text-xs text-muted-foreground">书评加载失败</p>
              ) : !myComments?.items.length ? (
                <EmptyState
                  compact
                  icon={MessageSquare}
                  title="还没有发表过书评"
                  description="在书籍详情或阅读器页面发表你的第一条书评。"
                />
              ) : (
                <ul className="divide-y divide-border/70">
                  {myComments.items.map((comment) => (
                    <li key={comment.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CommentStatusBadge status={comment.status} />
                        <span className="text-[11px] text-muted-foreground">{formatRelative(comment.createdAt)}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {comment.novel?.title
                            ? `《${comment.novel.title}》${comment.chapter ? ` · ${comment.chapter.title}` : ''}`
                            : '——'}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/85">{truncate(comment.content, 140)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            登录状态已失效，正在跳转登录页…
          </CardContent>
        </Card>
      )}
    </MemberPageFrame>
  );
}
