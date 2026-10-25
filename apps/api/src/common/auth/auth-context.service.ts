import { Injectable } from '@nestjs/common';
import { ALL_PERMISSION_CODES } from '@wmcms/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../types';

const CACHE_TTL_MS = 30_000;

/**
 * 管理员权限上下文加载与缓存。
 * 权限变更后 30 秒内自动生效；如需立即生效，调用 invalidate/invalidateAll。
 */
@Injectable()
export class AuthContextService {
  private readonly cache = new Map<string, { ctx: AuthContext; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string): Promise<AuthContext | null> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.ctx;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        userSites: true,
      },
    });
    if (!user) {
      this.cache.delete(userId);
      return null;
    }

    const permissionCodes = new Set<string>(
      user.isSuperAdmin
        ? ALL_PERMISSION_CODES
        : user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
    );

    const ctx: AuthContext = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      permissionCodes,
      siteIds: new Set(user.userSites.map((us) => us.siteId)),
    };
    this.cache.set(userId, { ctx, expiresAt: now + CACHE_TTL_MS });
    return ctx;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
