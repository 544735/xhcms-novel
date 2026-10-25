'use client';

/**
 * 令牌与站点上下文的本地存储。
 * 抽离为独立模块，避免 api 客户端与 auth store 相互依赖。
 */
const ACCESS_KEY = 'wmcms:access_token';
const REFRESH_KEY = 'wmcms:refresh_token';
const SITE_KEY = 'wmcms:current_site';
const MEMBER_KEY = 'wmcms:member_token';

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式下忽略 */
  }
}

export const tokenStorage = {
  getAccess: (): string | null => safeGet(ACCESS_KEY),
  getRefresh: (): string | null => safeGet(REFRESH_KEY),
  set(accessToken: string, refreshToken: string): void {
    safeSet(ACCESS_KEY, accessToken);
    safeSet(REFRESH_KEY, refreshToken);
  },
  setAccess(accessToken: string): void {
    safeSet(ACCESS_KEY, accessToken);
  },
  clear(): void {
    safeSet(ACCESS_KEY, null);
    safeSet(REFRESH_KEY, null);
    safeSet(SITE_KEY, null);
  },
  getSiteId: (): string | null => safeGet(SITE_KEY),
  setSiteId(siteId: string | null): void {
    safeSet(SITE_KEY, siteId);
  },

  /* ---------------- 门户会员令牌（与管理员令牌隔离） ---------------- */
  getMemberToken: (): string | null => safeGet(MEMBER_KEY),
  setMemberToken(token: string | null): void {
    safeSet(MEMBER_KEY, token);
  },
};
