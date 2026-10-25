import { BadRequestException, Injectable } from '@nestjs/common';
import type { SettingsMap } from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { assertSiteAccess } from '../sites/sites.service';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 读取设置并按 group 聚合；siteId 为 null 表示全局设置 */
  async getMap(siteId: string | null): Promise<SettingsMap> {
    const rows = await this.prisma.setting.findMany({
      where: { siteId },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    const map: SettingsMap = {};
    for (const row of rows) {
      const group = row.group || 'general';
      if (!map[group]) map[group] = {};
      map[group][row.key] = row.value;
    }
    return map;
  }

  /** 读取设置（带站点授权校验） */
  async read(siteId: string | undefined, auth: AuthContext): Promise<SettingsMap> {
    const scoped = siteId ?? null;
    if (scoped) assertSiteAccess(auth, scoped);
    return this.getMap(scoped);
  }

  /** 批量 upsert 设置项 */
  async save(
    dto: UpdateSettingsDto,
    fallbackSiteId: string | undefined,
    auth: AuthContext,
    req: AuthenticatedRequest,
  ): Promise<SettingsMap> {
    const siteId = dto.siteId !== undefined ? dto.siteId : (fallbackSiteId ?? null);

    if (siteId) {
      assertSiteAccess(auth, siteId);
      const site = await this.prisma.site.findUnique({
        where: { id: siteId },
        select: { id: true },
      });
      if (!site) throw new BadRequestException('站点不存在');
    }

    const savedKeys: string[] = [];
    for (const item of dto.items) {
      const key = item.key.trim();
      if (!key) continue;
      const group = item.group?.trim() ? item.group.trim().slice(0, 40) : 'general';
      const value = item.value === undefined ? null : item.value;

      if (siteId) {
        await this.prisma.setting.upsert({
          where: { siteId_key: { siteId, key } },
          update: { value, group },
          create: { siteId, key, value, group },
        });
      } else {
        // SQLite 的唯一索引对 NULL 不去重，全局设置需手工查重后更新
        const existing = await this.prisma.setting.findFirst({
          where: { siteId: null, key },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.setting.update({
            where: { id: existing.id },
            data: { value, group },
          });
        } else {
          await this.prisma.setting.create({ data: { siteId: null, key, value, group } });
        }
      }
      savedKeys.push(key);
    }

    await this.audit.log(req, {
      action: 'setting.update',
      resource: 'setting',
      resourceId: siteId,
      detail: { siteId, keys: savedKeys },
    });
    return this.getMap(siteId);
  }
}
