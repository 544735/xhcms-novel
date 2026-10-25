import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { AdminUser, Paginated } from '@wmcms/shared';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import { AuthContextService } from '../../common/auth/auth-context.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { toAdminUser, USER_PROFILE_INCLUDE } from '../auth/profile.util';
import type { CreateUserDto } from './dto/create-user.dto';
import type { QueryUserDto } from './dto/query-user.dto';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;
const SUPER_ADMIN_ROLE_CODE = 'super_admin';

const uniqueIds = (ids?: string[]): string[] =>
  ids ? [...new Set(ids.map((id) => id.trim()).filter(Boolean))] : [];

/**
 * 管理员账号管理。
 * 规则：不可删除/禁用自己；不可删除最后一个超管；super_admin 角色与超管标记仅超管可分配。
 * 任意写操作后清空该用户的权限缓存，使 RBAC 变更立即生效。
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authContext: AuthContextService,
  ) {}

  async list(query: QueryUserDto): Promise<Paginated<AdminUser>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.UserWhereInput = {};
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { email: { contains: keyword } },
        { nickname: { contains: keyword } },
      ];
    }
    if (query.status) where.status = query.status;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: USER_PROFILE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const allSites = rows.some((row) => row.isSuperAdmin) ? await this.findSites() : [];
    return paginate(
      rows.map((row) => toAdminUser(row, allSites)),
      total,
      page,
      pageSize,
    );
  }

  async get(id: string): Promise<AdminUser> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: USER_PROFILE_INCLUDE,
    });
    if (!row) throw new NotFoundException('管理员不存在');
    const allSites = row.isSuperAdmin ? await this.findSites() : [];
    return toAdminUser(row, allSites);
  }

  async create(
    dto: CreateUserDto,
    req: AuthenticatedRequest,
    current: AuthContext,
  ): Promise<AdminUser> {
    const username = dto.username.trim();
    const email = dto.email.trim();
    await this.assertUniqueAccount(username, email);

    const roleIds = uniqueIds(dto.roleIds);
    const siteIds = uniqueIds(dto.siteIds);
    const roles = await this.assertRoles(roleIds);
    await this.assertSites(siteIds);

    const wantsSuperAdmin =
      dto.isSuperAdmin === true || roles.some((role) => role.code === SUPER_ADMIN_ROLE_CODE);
    if (wantsSuperAdmin) this.assertCanManageSuperAdmin(current);

    const created = await this.prisma.user.create({
      data: {
        username,
        email,
        password: await hash(dto.password, BCRYPT_ROUNDS),
        nickname: dto.nickname ?? null,
        avatar: dto.avatar ?? null,
        status: dto.status ?? 'active',
        isSuperAdmin: dto.isSuperAdmin ?? false,
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
        userSites: { create: siteIds.map((siteId) => ({ siteId })) },
      },
    });

    this.authContext.invalidate(created.id);
    await this.audit.log(req, {
      action: 'user.create',
      resource: 'user',
      resourceId: created.id,
      detail: {
        username: created.username,
        email: created.email,
        roleIds,
        siteIds,
        isSuperAdmin: created.isSuperAdmin,
      },
    });
    return this.get(created.id);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    req: AuthenticatedRequest,
    current: AuthContext,
  ): Promise<AdminUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('管理员不存在');

    const username = dto.username?.trim() ?? existing.username;
    const email = dto.email?.trim() ?? existing.email;
    await this.assertUniqueAccount(username, email, id);

    const roleIds = dto.roleIds ? uniqueIds(dto.roleIds) : undefined;
    const siteIds = dto.siteIds ? uniqueIds(dto.siteIds) : undefined;
    const roles = roleIds ? await this.assertRoles(roleIds) : undefined;
    if (siteIds) await this.assertSites(siteIds);

    const nextSuperAdmin = dto.isSuperAdmin ?? existing.isSuperAdmin;
    const assignsSuperAdminRole =
      roles?.some((role) => role.code === SUPER_ADMIN_ROLE_CODE) ?? false;
    if (
      !current.isSuperAdmin &&
      (nextSuperAdmin !== existing.isSuperAdmin || assignsSuperAdminRole)
    ) {
      this.assertCanManageSuperAdmin(current);
    }
    if (dto.status === 'disabled' && id === current.id) {
      throw new BadRequestException('不能禁用自己的账号');
    }

    const password = dto.password ? await hash(dto.password, BCRYPT_ROUNDS) : undefined;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.UserUpdateInput = { username, email };
      if (dto.nickname !== undefined) data.nickname = dto.nickname;
      if (dto.avatar !== undefined) data.avatar = dto.avatar;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.isSuperAdmin !== undefined) data.isSuperAdmin = dto.isSuperAdmin;
      if (password) data.password = password;
      await tx.user.update({ where: { id }, data });

      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roleIds.length) {
          await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
        }
      }
      if (siteIds) {
        await tx.userSite.deleteMany({ where: { userId: id } });
        if (siteIds.length) {
          await tx.userSite.createMany({ data: siteIds.map((siteId) => ({ userId: id, siteId })) });
        }
      }
    });

    this.authContext.invalidate(id);
    await this.audit.log(req, {
      action: 'user.update',
      resource: 'user',
      resourceId: id,
      detail: {
        username,
        email,
        roleIds,
        siteIds,
        status: dto.status,
        isSuperAdmin: dto.isSuperAdmin,
        passwordReset: dto.password !== undefined,
      },
    });
    return this.get(id);
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    req: AuthenticatedRequest,
    current: AuthContext,
  ): Promise<AdminUser> {
    if (dto.status === 'disabled' && id === current.id) {
      throw new BadRequestException('不能禁用自己的账号');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('管理员不存在');

    await this.prisma.user.update({ where: { id }, data: { status: dto.status } });
    this.authContext.invalidate(id);
    await this.audit.log(req, {
      action: 'user.status',
      resource: 'user',
      resourceId: id,
      detail: { username: target.username, status: dto.status },
    });
    return this.get(id);
  }

  async remove(id: string, req: AuthenticatedRequest, current: AuthContext): Promise<null> {
    if (id === current.id) throw new BadRequestException('不能删除当前登录账号');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('管理员不存在');
    if (target.isSuperAdmin) {
      const superAdminCount = await this.prisma.user.count({ where: { isSuperAdmin: true } });
      if (superAdminCount <= 1) {
        throw new BadRequestException('系统至少需要保留一个超级管理员');
      }
    }

    await this.prisma.user.delete({ where: { id } });
    this.authContext.invalidate(id);
    await this.audit.log(req, {
      action: 'user.delete',
      resource: 'user',
      resourceId: id,
      detail: { username: target.username, email: target.email },
    });
    return null;
  }

  private findSites() {
    return this.prisma.site.findMany({ orderBy: { createdAt: 'asc' } });
  }

  private assertCanManageSuperAdmin(current: AuthContext): void {
    if (!current.isSuperAdmin) {
      throw new ForbiddenException('仅超级管理员可分配 super_admin 角色或设置超管标记');
    }
  }

  private async assertUniqueAccount(
    username: string,
    email: string,
    excludeId?: string,
  ): Promise<void> {
    const exclude = excludeId ? { NOT: { id: excludeId } } : {};
    const [byUsername, byEmail] = await Promise.all([
      this.prisma.user.findFirst({
        where: { username, ...exclude },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { email, ...exclude },
        select: { id: true },
      }),
    ]);
    if (byUsername) throw new ConflictException('用户名已存在');
    if (byEmail) throw new ConflictException('邮箱已被使用');
  }

  private async assertRoles(roleIds: string[]): Promise<{ id: string; code: string }[]> {
    if (!roleIds.length) return [];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, code: true },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('存在无效的角色 ID');
    }
    return roles;
  }

  private async assertSites(siteIds: string[]): Promise<void> {
    if (!siteIds.length) return;
    const count = await this.prisma.site.count({ where: { id: { in: siteIds } } });
    if (count !== siteIds.length) {
      throw new BadRequestException('存在无效的站点 ID');
    }
  }
}
