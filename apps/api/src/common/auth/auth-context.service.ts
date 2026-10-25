import { Injectable } from '@nestjs/common';
import { ALL_PERMISSION_CODES } from '@wmcms/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthContext } from '../types';

/** 默认缓存 TTL：30 秒（可用 AUTH_CACHE_TTL_MS 覆盖，非法值回落默认） */
const DEFAULT_CACHE_TTL_MS = 30_000;

function resolveCacheTtlMs(): number {
  const raw = process.env.AUTH_CACHE_TTL_MS;
  if (!raw) return DEFAULT_CACHE_TTL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // 0 / 负数 / NaN 都回落默认，避免退化成「每次回源」或「永不过期」
    return DEFAULT_CACHE_TTL_MS;
  }
  return Math.floor(parsed);
}

/**
 * 管理员权限上下文加载与缓存。
 * 默认 TTL 内自动生效；如需立即生效，调用 invalidate/invalidateAll。
 * 注意：invalidate 只清理「当前进程」的缓存 —— 多实例部署时，
 * 其它实例最长 TTL（默认 30s）后才会看到权限/状态变更；跨实例即时生效需共享缓存（如 Redis）。
 */
@Injectable()
export class AuthContextService {
  private readonly cache = new Map<string, { ctx: AuthContext; expiresAt: number }>();
  private readonly ttlMs = resolveCacheTtlMs();

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
      tokenVersion: user.tokenVersion,
      permissionCodes,
      siteIds: new Set(user.userSites.map((us) => us.siteId)),
    };
    this.cache.set(userId, { ctx, expiresAt: now + this.ttlMs });
    return ctx;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
