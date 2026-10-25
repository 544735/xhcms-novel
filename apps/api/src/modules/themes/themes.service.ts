import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { THEMES } from '@wmcms/shared';
import type { PublicThemePayload, Site, Theme } from '@wmcms/shared';
import type { Theme as PrismaTheme } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import {
  SitesService,
  assertSiteAccess,
  toPublicSite,
  toSiteDto,
} from '../sites/sites.service';
import type { ActivateThemeDto } from './dto/activate-theme.dto';

function parseThemeConfig(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toThemeDto(row: PrismaTheme, activeSites: number): Theme {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    preview: row.preview,
    builtin: row.builtin,
    config: parseThemeConfig(row.config),
    sort: row.sort,
    activeSites,
  };
}

@Injectable()
export class ThemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sites: SitesService,
  ) {}

  /** 主题列表（含使用中的站点数） */
  async list(): Promise<Theme[]> {
    const [rows, grouped] = await Promise.all([
      this.prisma.theme.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.site.groupBy({ by: ['themeKey'], _count: { _all: true } }),
    ]);
    const counts = new Map<string, number>(
      grouped.map((item) => [item.themeKey, item._count._all]),
    );
    return rows.map((row) => toThemeDto(row, counts.get(row.key) ?? 0));
  }

  /** 切换站点主题 */
  async activate(
    dto: ActivateThemeDto,
    auth: AuthContext,
    req: AuthenticatedRequest,
  ): Promise<Site> {
    assertSiteAccess(auth, dto.siteId);

    const [theme, site] = await Promise.all([
      this.prisma.theme.findUnique({ where: { key: dto.themeKey } }),
      this.prisma.site.findUnique({ where: { id: dto.siteId } }),
    ]);
    if (!theme) throw new NotFoundException('主题不存在');
    if (!site) throw new NotFoundException('站点不存在');

    const updated = await this.prisma.site.update({
      where: { id: dto.siteId },
      data: { themeKey: dto.themeKey },
    });

    await this.audit.log(req, {
      action: 'theme.activate',
      resource: 'site',
      resourceId: dto.siteId,
      detail: { site: updated.name, from: site.themeKey, to: dto.themeKey },
    });
    return toSiteDto(updated);
  }

  /** 门户：站点 + 当前主题配置 */
  async publicTheme(siteSlug: string): Promise<PublicThemePayload> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const row = await this.prisma.theme.findUnique({ where: { key: site.themeKey } });

    if (!row) {
      const fallback = THEMES.find((item) => item.key === site.themeKey);
      if (!fallback) throw new BadRequestException('站点主题配置缺失');
      return {
        site: toPublicSite(site),
        theme: { key: fallback.key, name: fallback.name, config: fallback.config },
      };
    }

    return {
      site: toPublicSite(site),
      theme: {
        key: row.key,
        name: row.name,
        config: parseThemeConfig(row.config),
      },
    };
  }
}
