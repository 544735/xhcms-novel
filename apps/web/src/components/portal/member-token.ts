'use client';

/**
 * 会员令牌存储。
 * 门户会员与后台管理员使用互相独立的 token（key 不同），避免管理端退出登录影响门户会员态。
 */
export const MEMBER_TOKEN_KEY = 'wmcms:member_token';

export function getMemberToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(MEMBER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setMemberToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MEMBER_TOKEN_KEY, token);
  } catch {
    /* 隐私模式下忽略 */
  }
}

export function clearMemberToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MEMBER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
