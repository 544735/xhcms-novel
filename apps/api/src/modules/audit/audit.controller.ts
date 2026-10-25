import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLog, Paginated } from '@wmcms/shared';
import type { Prisma } from '@prisma/client';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

/** 结束时间只有日期（YYYY-MM-DD）时补到当天最后一毫秒，保证「到某天」包含整天。 */
function resolveToDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}

@ApiTags('操作日志')
@ApiBearerAuth('admin')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit:view')
  @ApiOperation({ summary: '操作日志分页列表（userId/action/resource/from/to 筛选，按时间倒序）' })
  async list(@Query() query: QueryAuditLogDto): Promise<Paginated<AuditLog>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) where.userId = query.userId;
    if (query.action?.trim()) where.action = { contains: query.action.trim() };
    if (query.resource?.trim()) where.resource = { contains: query.resource.trim() };

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) createdAt.lte = resolveToDate(query.to);
    if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { action: { contains: keyword } },
        { resource: { contains: keyword } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
    ]);

    const items: AuditLog[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      username: row.username,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      detail: row.detail,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt.toISOString(),
    }));
    return paginate(items, total, page, pageSize);
  }
}
