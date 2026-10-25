import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated, Permission, Role, RoleSummary } from '@wmcms/shared';
import type { Prisma } from '@prisma/client';

import { AuditService } from '../../common/audit/audit.service';
import { AuthContextService } from '../../common/auth/auth-context.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { QueryRoleDto } from './dto/query-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

type RoleRow = Prisma.RoleGetPayload<{
  include: {
    permissions: { include: { permission: true } };
    _count: { select: { users: true } };
  };
}>;

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

function toPermission(code: string, name: string, group: string): Permission {
  return { code, name, group };
}

function toRole(row: RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions
      .map((item) => toPermission(item.permission.code, item.permission.name, item.permission.group))
      .sort((a, b) => a.code.localeCompare(b.code)),
    userCount: row._count.users,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const uniqueCodes = (codes: string[] = []): string[] =>
  [...new Set(codes.map((code) => code.trim()).filter(Boolean))];

/**
 * 角色与权限目录。
 * code 唯一且创建后不可修改；内置角色禁止删除；权限变更全量替换并清空全局权限缓存。
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authContext: AuthContextService,
  ) {}

  async list(query: QueryRoleDto): Promise<Paginated<Role>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.RoleWhereInput = {};
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        include: ROLE_INCLUDE,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
    ]);
    return paginate(rows.map(toRole), total, page, pageSize);
  }

  async options(): Promise<RoleSummary[]> {
    const rows = await this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, code: true },
    });
    return rows;
  }

  async get(id: string): Promise<Role> {
    const row = await this.prisma.role.findUnique({ where: { id }, include: ROLE_INCLUDE });
    if (!row) throw new NotFoundException('角色不存在');
    return toRole(row);
  }

  async create(dto: CreateRoleDto, req: AuthenticatedRequest): Promise<Role> {
    const code = dto.code.trim();
    const name = dto.name.trim();
    const duplicated = await this.prisma.role.findUnique({ where: { code }, select: { id: true } });
    if (duplicated) throw new ConflictException('角色编码已存在');

    const permissionCodes = uniqueCodes(dto.permissionCodes);
    const permissions = await this.resolvePermissions(permissionCodes);

    const role = await this.prisma.role.create({
      data: {
        name,
        code,
        description: dto.description ?? null,
        isSystem: false,
        permissions: {
          create: permissions.map((permission) => ({ permissionId: permission.id })),
        },
      },
    });

    this.authContext.invalidateAll();
    await this.audit.log(req, {
      action: 'role.create',
      resource: 'role',
      resourceId: role.id,
      detail: { name, code, permissionCodes },
    });
    return this.get(role.id);
  }

  async update(id: string, dto: UpdateRoleDto, req: AuthenticatedRequest): Promise<Role> {
    const existing = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!existing) throw new NotFoundException('角色不存在');

    if (dto.code !== undefined && dto.code.trim() !== existing.code) {
      throw new BadRequestException('角色编码创建后不可修改');
    }

    const permissionCodes = dto.permissionCodes ? uniqueCodes(dto.permissionCodes) : undefined;
    const permissions = permissionCodes ? await this.resolvePermissions(permissionCodes) : undefined;

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.RoleUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.description !== undefined) data.description = dto.description;
      await tx.role.update({ where: { id }, data });

      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissions.length) {
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({
              roleId: id,
              permissionId: permission.id,
            })),
          });
        }
      }
    });

    this.authContext.invalidateAll();
    await this.audit.log(req, {
      action: 'role.update',
      resource: 'role',
      resourceId: id,
      detail: {
        name: dto.name,
        description: dto.description,
        permissionCodes,
      },
    });
    return this.get(id);
  }

  async remove(id: string, req: AuthenticatedRequest): Promise<null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.isSystem) throw new BadRequestException('内置角色不允许删除');
    if (role._count.users > 0) {
      throw new BadRequestException('该角色下仍有管理员，请先调整管理员角色');
    }

    await this.prisma.role.delete({ where: { id } });
    this.authContext.invalidateAll();
    await this.audit.log(req, {
      action: 'role.delete',
      resource: 'role',
      resourceId: id,
      detail: { name: role.name, code: role.code },
    });
    return null;
  }

  /** 校验权限编码均存在于数据库，返回对应记录。 */
  private async resolvePermissions(
    codes: string[],
  ): Promise<{ id: string; code: string }[]> {
    if (!codes.length) return [];
    const rows = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    if (rows.length !== codes.length) {
      const known = new Set(rows.map((row) => row.code));
      const unknown = codes.filter((code) => !known.has(code));
      throw new BadRequestException(`存在无效的权限编码：${unknown.join('、')}`);
    }
    return rows;
  }
}
