'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { tokenStorage } from '@/lib/tokens';
import { isMemberAuthError } from '@/components/portal/client/member-client';

export interface MemberGuardState {
  /** 会员 token（null 表示未登录，已触发跳转） */
  token: string | null;
  /** token 读取完成；false 时不要渲染需要 token 的内容 */
  ready: boolean;
  /** 清除 token 并跳转会员登录页 */
  redirectToLogin: () => void;
  /** 查询/变更报 401 时调用：自动清理并跳转，返回是否已处理 */
  handleAuthError: (error: unknown) => boolean;
}

/**
 * 会员页面客户端守卫：
 * - 无 `wmcms:member_token` → 跳转 `${basePath}/member/login`；
 * - 接口返回 401（token 过期/被吊销）→ 清理本地 token 并跳转登录。
 */
export function useMemberGuard(basePath: string): MemberGuardState {
  const router = useRouter();
  const [token, setToken] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  const redirectToLogin = React.useCallback(() => {
    tokenStorage.setMemberToken(null);
    router.replace(`${basePath}/member/login`);
  }, [router, basePath]);

  React.useEffect(() => {
    const current = tokenStorage.getMemberToken();
    if (!current) {
      router.replace(`${basePath}/member/login`);
      return;
    }
    setToken(current);
    setReady(true);
  }, [router, basePath]);

  const handleAuthError = React.useCallback(
    (error: unknown) => {
      if (!isMemberAuthError(error)) return false;
      redirectToLogin();
      return true;
    },
    [redirectToLogin],
  );

  return { token, ready, redirectToLogin, handleAuthError };
}
