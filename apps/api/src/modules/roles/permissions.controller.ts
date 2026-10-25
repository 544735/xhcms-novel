import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSION_GROUPS } from '@wmcms/shared';
import type { Permission, PermissionGroup } from '@wmcms/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * 权限点目录（只读）。数据以数据库为准，分组顺序按 shared 的 PERMISSION_GROUPS 稳定输出，
 * 便于前端权限矩阵固定展示顺序。
 */
@ApiTags('权限')
@ApiBearerAuth('admin')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '权限点分组列表（登录即可）' })
  async list(): Promise<PermissionGroup[]> {
    const rows = await this.prisma.permission.findMany({ orderBy: { code: 'asc' } });

    const byGroup = new Map<string, Permission[]>();
    for (const row of rows) {
      const item: Permission = { code: row.code, name: row.name, group: row.group };
      const items = byGroup.get(row.group);
      if (items) items.push(item);
      else byGroup.set(row.group, [item]);
    }

    const preferredOrder = PERMISSION_GROUPS.map((group) => group.group);
    const extraGroups = [...byGroup.keys()].filter((group) => !preferredOrder.includes(group));
    return [...preferredOrder, ...extraGroups]
      .filter((group) => byGroup.has(group))
      .map((group) => ({ group, items: byGroup.get(group) ?? [] }));
  }
}
