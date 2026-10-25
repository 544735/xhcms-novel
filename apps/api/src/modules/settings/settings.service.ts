import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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

  /** 读取设置（全局设置仅超管可见；站点设置校验站点授权） */
  async read(siteId: string | undefined, auth: AuthContext): Promise<SettingsMap> {
    const scoped = siteId ?? null;
    if (scoped) {
      assertSiteAccess(auth, scoped);
    } else if (!auth.isSuperAdmin) {
      // 全局设置作用于整个平台，站点管理员不得读取
      throw new ForbiddenException('仅超级管理员可查看全局设置');
    }
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
    } else if (!auth.isSuperAdmin) {
      // siteId 为 null 即平台级全局设置，站点管理员不得写入（含 body 显式传 null 的情形）
      throw new ForbiddenException('仅超级管理员可修改全局设置');
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
        // 全局设置（siteId IS NULL）由部分唯一索引 Setting_global_key_unique 保证唯一：
        // 先插入，命中唯一约束（并发插入同一 key）再转为更新，避免重复行与丢失更新。
        try {
          await this.prisma.setting.create({ data: { siteId: null, key, value, group } });
        } catch (error) {
          if ((error as { code?: string }).code !== 'P2002') throw error;
          await this.prisma.setting.updateMany({
            where: { siteId: null, key },
            data: { value, group },
          });
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
