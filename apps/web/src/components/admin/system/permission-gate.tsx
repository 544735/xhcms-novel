'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthStore } from '@/lib/auth';

/** 无权限占位（直接访问受限路由时显示） */
export function NoPermission({ permission }: { permission?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <EmptyState
        icon={ShieldAlert}
        title="没有访问权限"
        description={
          permission
            ? `当前账号缺少 ${permission} 权限，请联系超级管理员分配角色。`
            : '当前账号没有访问该页面的权限，请联系超级管理员分配角色。'
        }
        action={
          <Link
            href="/admin"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            返回仪表盘
          </Link>
        }
      />
    </div>
  );
}

/** 页面级权限控制：缺少权限时渲染占位，避免直接输入 URL 越权访问 */
export function PermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  if (!hasPermission(permission)) return <NoPermission permission={permission} />;
  return <>{children}</>;
}
