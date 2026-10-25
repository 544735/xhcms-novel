import { Injectable, NotFoundException } from '@nestjs/common';
import type { Plugin as PrismaPlugin } from '@prisma/client';
import type { Plugin } from '@wmcms/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import type { AuthenticatedRequest } from '../../common/types';
import { UpdatePluginDto } from './dto/update-plugin.dto';

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function toPlugin(row: PrismaPlugin): Plugin {
  return {
    key: row.key,
    name: row.name,
    version: row.version,
    description: row.description,
    author: row.author,
    enabled: row.enabled,
    builtin: row.builtin,
    hooks: parseStringArray(row.hooks),
    config: parseObject(row.config),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PluginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
  ) {}

  async list(): Promise<Plugin[]> {
    const rows = await this.prisma.plugin.findMany({
      orderBy: [{ builtin: 'desc' }, { key: 'asc' }],
    });
    return rows.map(toPlugin);
  }

  async get(key: string): Promise<Plugin> {
    const row = await this.prisma.plugin.findUnique({ where: { key } });
    if (!row) throw new NotFoundException('插件不存在');
    return toPlugin(row);
  }

  /**
   * 启停 / 配置更新。
   * 入库后立即调用 pluginHost.reload()，使开关与配置在当前进程内热生效。
   */
  async update(
    key: string,
    dto: UpdatePluginDto,
    req?: AuthenticatedRequest,
  ): Promise<Plugin> {
    const existing = await this.prisma.plugin.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('插件不存在');

    const data: { enabled?: boolean; config?: string } = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.config !== undefined) {
      const current = parseObject(existing.config) ?? {};
      data.config = JSON.stringify({ ...current, ...dto.config });
    }

    if (!Object.keys(data).length) return toPlugin(existing);

    await this.prisma.plugin.update({ where: { key }, data });
    // 热生效：重新注册启用插件的钩子处理器
    await this.pluginHost.reload();

    const row = await this.prisma.plugin.findUnique({ where: { key } });
    await this.audit.log(req, {
      action: 'plugin.update',
      resource: 'plugin',
      resourceId: key,
      detail: {
        enabled: data.enabled,
        configKeys: dto.config ? Object.keys(dto.config) : undefined,
      },
    });

    return toPlugin(row ?? existing);
  }
}
