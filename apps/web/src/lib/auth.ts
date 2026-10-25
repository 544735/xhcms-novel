'use client';

import type { SiteSummary, UserProfile } from '@wmcms/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, ApiError } from './api';
import { tokenStorage } from './tokens';

interface AuthState {
  user: UserProfile | null;
  currentSiteId: string | null;
  /** 是否已完成本地状态恢复（persist） */
  hydrated: boolean;
  /** 是否正在校验/拉取用户信息 */
  refreshing: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<UserProfile | null>;
  setCurrentSite: (siteId: string) => void;
  sites: () => SiteSummary[];
  currentSite: () => SiteSummary | null;
  hasPermission: (code: string) => boolean;
  isSuperAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentSiteId: null,
      hydrated: false,
      refreshing: false,

      async login(username, password) {
        const result = await api.auth.login({ username, password });
        tokenStorage.set(result.accessToken, result.refreshToken);
        const siteId = result.user.sites[0]?.id ?? null;
        tokenStorage.setSiteId(siteId);
        set({ user: result.user, currentSiteId: siteId, hydrated: true });
        return result.user;
      },

      async logout() {
        try {
          await api.auth.logout();
        } catch {
          /* 令牌可能已过期，忽略 */
        }
        tokenStorage.clear();
        set({ user: null, currentSiteId: null, refreshing: false });
      },

      async fetchProfile() {
        if (!tokenStorage.getAccess()) return null;
        set({ refreshing: true });
        try {
          const user = await api.auth.profile();
          const currentSiteId = get().currentSiteId;
          const validSite = user.sites.some((site) => site.id === currentSiteId);
          const nextSiteId = validSite ? currentSiteId : (user.sites[0]?.id ?? null);
          tokenStorage.setSiteId(nextSiteId);
          set({ user, currentSiteId: nextSiteId, refreshing: false });
          return user;
        } catch (error) {
          set({ refreshing: false });
          if (error instanceof ApiError && error.status === 401) {
            tokenStorage.clear();
            set({ user: null, currentSiteId: null });
          }
          return null;
        }
      },

      setCurrentSite(siteId) {
        tokenStorage.setSiteId(siteId);
        set({ currentSiteId: siteId });
      },

      sites() {
        return get().user?.sites ?? [];
      },

      currentSite() {
        const { user, currentSiteId } = get();
        return user?.sites.find((site) => site.id === currentSiteId) ?? user?.sites[0] ?? null;
      },

      hasPermission(code) {
        const user = get().user;
        if (!user) return false;
        if (user.isSuperAdmin) return true;
        return user.permissions.includes(code);
      },

      isSuperAdmin() {
        return get().user?.isSuperAdmin ?? false;
      },
    }),
    {
      name: 'wmcms:auth',
      partialize: (state) => ({ user: state.user, currentSiteId: state.currentSiteId }),
      onRehydrateStorage: () => (state) => {
        state?.hydrated !== undefined && useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

export function hasPermission(code: string): boolean {
  return useAuthStore.getState().hasPermission(code);
}
