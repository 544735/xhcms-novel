import { ALL_PERMISSION_CODES } from '@wmcms/shared';
import type {
  AdminUser,
  SiteStatus,
  SiteSummary,
  UserProfile,
  UserStatus,
} from '@wmcms/shared';
import { Prisma } from '@prisma/client';
import type { Site } from '@prisma/client';

/**
 * 管理员「资料视图」统一 include 与映射。
 * auth / users 两个模块共用，避免两处 include 漂移导致字段缺失。
 */
export const USER_PROFILE_INCLUDE = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
  userSites: { include: { site: true } },
} satisfies Prisma.UserInclude;

export type UserWithProfile = Prisma.UserGetPayload<{ include: typeof USER_PROFILE_INCLUDE }>;

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

export function toSiteSummary(
  site: Pick<Site, 'id' | 'name' | 'slug' | 'domain' | 'themeKey' | 'status'>,
): SiteSummary {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    themeKey: site.themeKey,
    status: site.status as SiteStatus,
  };
}

/** 超管返回全量权限码；其余按角色并集去重。 */
export function resolvePermissionCodes(user: UserWithProfile): string[] {
  if (user.isSuperAdmin) return [...ALL_PERMISSION_CODES];
  const codes = new Set<string>();
  for (const userRole of user.roles) {
    for (const rolePermission of userRole.role.permissions) {
      codes.add(rolePermission.permission.code);
    }
  }
  return [...codes];
}

/**
 * 映射为 UserProfile。
 * 超管默认拥有全部站点（seed 中未给 admin 分配 UserSite），因此传入 allSites。
 */
export function toUserProfile(user: UserWithProfile, allSites: Site[] = []): UserProfile {
  const sites = user.isSuperAdmin ? allSites : user.userSites.map((item) => item.site);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    avatar: user.avatar,
    status: user.status as UserStatus,
    isSuperAdmin: user.isSuperAdmin,
    lastLoginAt: iso(user.lastLoginAt),
    roles: user.roles.map((item) => ({
      id: item.role.id,
      name: item.role.name,
      code: item.role.code,
    })),
    permissions: resolvePermissionCodes(user),
    sites: sites.map(toSiteSummary),
    createdAt: user.createdAt.toISOString(),
  };
}

/** UserProfile + roleIds/siteIds（后台管理员管理使用）。 */
export function toAdminUser(user: UserWithProfile, allSites: Site[] = []): AdminUser {
  return {
    ...toUserProfile(user, allSites),
    roleIds: user.roles.map((item) => item.roleId),
    siteIds: user.userSites.map((item) => item.siteId),
  };
}
