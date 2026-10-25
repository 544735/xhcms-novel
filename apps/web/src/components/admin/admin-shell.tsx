'use client';

import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  Plus,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ADMIN_NAV } from './nav';
import { SiteSwitcher } from './site-switcher';
import { ThemeToggle } from './theme-toggle';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((item) => {
          if (!item.permission) return true;
          return isSuperAdmin() || hasPermission(item.permission);
        });
        if (!items.length) return null;
        return (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn('sidebar-link', active && 'sidebar-link-active')}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-sidebar-muted')} />
                    <span className="truncate">{item.label}</span>
                    {active ? <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/70" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((state) => state.user);
  const currentSite = useAuthStore((state) => state.currentSite());

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-2.5 border-b border-border/70 px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-sm font-bold text-white shadow-glow">
          W
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">XHCMS</p>
          <p className="truncate text-[11px] text-sidebar-muted">现代化内容管理系统</p>
        </div>
        <span className="ml-auto rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
          v2.0
        </span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/70 gradient-soft px-3 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{currentSite?.name ?? '未选择站点'}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {currentSite ? `/${currentSite.slug}` : '请先创建站点'}
            </p>
          </div>
        </div>
      </div>

      <NavLinks onNavigate={onNavigate} />

      <div className="border-t border-border/70 p-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-muted transition-colors hover:bg-secondary hover:text-sidebar-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          访问门户前台
        </Link>
        <div className="mt-1 flex items-center gap-2.5 rounded-xl px-2 py-2">
          <Avatar size="sm" src={user?.avatar} name={user?.nickname ?? user?.username} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              {user?.nickname ?? user?.username}
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">
              {user?.roles?.map((role) => role.name).join(' · ') || '未分配角色'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/admin/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-up border-r border-border shadow-float">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="关闭菜单"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl sm:gap-3 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <SiteSwitcher />

          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => router.push('/admin/novels/new')}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                新建书籍
              </span>
            </Button>
            <ThemeToggle compact />
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="ml-0.5 flex items-center gap-2 rounded-full border border-border bg-card p-0.5 pr-2 shadow-sm transition-colors hover:bg-muted"
                  aria-label="账户菜单"
                >
                  <Avatar size="sm" src={user?.avatar} name={user?.nickname ?? user?.username} />
                  <span className="hidden max-w-24 truncate text-xs font-medium text-foreground sm:inline">
                    {user?.nickname ?? user?.username}
                  </span>
                </button>
              }
              items={[
                {
                  label: '个人资料',
                  icon: <UserRound className="h-3.5 w-3.5" />,
                  onSelect: () => router.push('/admin/profile'),
                },
                {
                  label: '站点设置',
                  icon: <Sparkles className="h-3.5 w-3.5" />,
                  onSelect: () => router.push('/admin/settings'),
                },
                {
                  label: '退出登录',
                  icon: <LogOut className="h-3.5 w-3.5" />,
                  danger: true,
                  separatorBefore: true,
                  onSelect: handleLogout,
                },
              ]}
            />
          </div>
        </header>

        <main className="admin-canvas min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
