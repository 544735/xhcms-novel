'use client';

import { Coins, History, Library, PenTool, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const MEMBER_LINKS = [
  { key: 'member', label: '会员中心', icon: UserRound },
  { key: 'shelf', label: '我的书架', icon: Library },
  { key: 'history', label: '阅读历史', icon: History },
  { key: 'vip', label: '充值 VIP', icon: Coins },
  { key: 'author-center', label: '作者中心', icon: PenTool },
] as const;

export function MemberNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar -mx-1 overflow-x-auto">
      <div className="flex min-w-max items-center gap-1 rounded-xl border border-border bg-card p-1">
        {MEMBER_LINKS.map((item) => {
          const href = `${basePath}/${item.key}`;
          const active =
            item.key === 'member'
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** 会员区域页面统一容器：标题 + 描述 + 子导航 + 内容 */
export function MemberPageFrame({
  basePath,
  title,
  description,
  actions,
  children,
}: {
  basePath: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <MemberNav basePath={basePath} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
