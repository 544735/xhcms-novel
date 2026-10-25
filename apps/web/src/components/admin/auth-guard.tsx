'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { LoadingBlock } from '@/components/ui/spinner';
import { useAuthStore } from '@/lib/auth';
import { tokenStorage } from '@/lib/tokens';

/**
 * 管理后台登录守卫：
 * - 无访问令牌 → 跳转登录页；
 * - 有令牌但无用户缓存 → 拉取 /auth/profile 校验；
 * - 令牌失效且刷新失败 → 清理并跳转。
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/admin/login');
        return;
      }
      if (!user) {
        await fetchProfile();
      }
      if (!active) return;
      if (!tokenStorage.getAccess()) {
        router.replace('/admin/login');
        return;
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingBlock label="正在验证登录状态…" />
      </div>
    );
  }

  return <>{children}</>;
}
