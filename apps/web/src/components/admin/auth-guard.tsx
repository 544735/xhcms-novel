'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { LoadingBlock } from '@/components/ui/spinner';
import { useAuthStore } from '@/lib/auth';
import { tokenStorage } from '@/lib/tokens';

/**
 * 管理后台登录守卫：
 * - 无访问令牌 → 跳转登录页；
 * - 有令牌 → **每次进入都**拉取 /auth/profile 校验，不信任 zustand 持久化里的 user 缓存
 *   （否则令牌过期/被吊销、或手改 localStorage 的 user 都能进后台壳）；
 * - 校验失败（401 / 网络异常）→ 清理令牌并跳转登录页；
 * - 令牌刷新失败（lib/api 派发 `auth:expired`）→ 同上清理并跳转。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/admin/login');
        return;
      }
      // 无条件校验：即使持久化缓存里有 user，也要用服务端结果确认会话仍然有效
      const profile = await fetchProfile();
      if (!active) return;
      if (!profile || !tokenStorage.getAccess()) {
        tokenStorage.clear();
        router.replace('/admin/login');
        return;
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchProfile, router]);

  // 其它请求触发刷新失败时（lib/api 派发 auth:expired），后台整体退出而不是卡在满屏报错
  React.useEffect(() => {
    const handleExpired = () => {
      tokenStorage.clear();
      router.replace('/admin/login');
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingBlock label="正在验证登录状态…" />
      </div>
    );
  }

  return <>{children}</>;
}
