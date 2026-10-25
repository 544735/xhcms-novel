import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Site as PrismaSite } from '@prisma/client';
import type {
  PublicSite,
  Site,
  SiteSettings,
  SiteStatus,
  SiteSummary,
} from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import type { CreateSiteDto } from './dto/create-site.dto';
import type { QuerySiteDto } from './dto/query-site.dto';
import type { UpdateSiteDto } from './dto/update-site.dto';

/* ----------------------------- 数据映射 ----------------------------- */

export function parseSiteSettings(raw: string | null | undefined): SiteSettings | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SiteSettings;
    }
    return null;
  } catch {
    return null;
  }
}

export function toSiteDto(site: PrismaSite): Site {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    themeKey: site.themeKey,
    logo: site.logo,
    description: site.description,
    seoTitle: site.seoTitle,
    seoKeywords: site.seoKeywords,
    seoDescription: site.seoDescription,
    status: site.status as SiteStatus,
    settings: parseSiteSettings(site.settings),
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

export function toSiteSummary(site: PrismaSite): SiteSummary {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    themeKey: site.themeKey,
    status: site.status as SiteStatus,
  };
}

export function toPublicSite(site: PrismaSite): PublicSite {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    logo: site.logo,
    description: site.description,
    themeKey: site.themeKey,
    settings: parseSiteSettings(site.settings),
    seoTitle: site.seoTitle,
    seoKeywords: site.seoKeywords,
    seoDescription: site.seoDescription,
  };
}

/** 校验当前管理员是否有权访问指定站点（超管直通） */
export function assertSiteAccess(auth: AuthContext | undefined, siteId: string): void {
  if (!auth) throw new UnauthorizedException('请先登录');
  if (!auth.isSuperAdmin && !auth.siteIds.has(siteId)) {
    throw new ForbiddenException('无权访问该站点');
  }
}

/** 去掉首尾空白；空串视为 null */
function optionalText(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/* ------------------------------- 服务 ------------------------------- */

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QuerySiteDto, auth: AuthContext) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.SiteWhereInput = {};

    if (query.status) where.status = query.status;
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { slug: { contains: keyword } },
        { domain: { contains: keyword } },
      ];
    }
    if (!auth.isSuperAdmin) {
      where.id = { in: Array.from(auth.siteIds) };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.site.count({ where }),
      this.prisma.site.findMany({ where, skip, take, orderBy: { createdAt: 'asc' } }),
    ]);
    return paginate(rows.map(toSiteDto), total, page, pageSize);
  }

  async options(auth: AuthContext): Promise<SiteSummary[]> {
    const where: Prisma.SiteWhereInput = auth.isSuperAdmin
      ? {}
      : { id: { in: Array.from(auth.siteIds) } };
    const rows = await this.prisma.site.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toSiteSummary);
  }

  async findOne(id: string): Promise<Site> {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('站点不存在');
    return toSiteDto(site);
  }

  /** 按 slug 查询站点（不校验状态，供内部使用） */
  async findBySlug(slug: string): Promise<PrismaSite> {
    const site = await this.prisma.site.findUnique({ where: { slug } });
    if (!site) throw new NotFoundException('站点不存在');
    return site;
  }

  /** 门户站点解析：仅启用中的站点可见 */
  async resolvePublicSite(slug: string): Promise<PrismaSite> {
    const site = await this.prisma.site.findUnique({ where: { slug } });
    if (!site || site.status !== 'enabled') {
      throw new NotFoundException('站点不存在或已关闭');
    }
    return site;
  }

  async create(dto: CreateSiteDto, req: AuthenticatedRequest): Promise<Site> {
    const slug = dto.slug.trim().toLowerCase();
    const slugExists = await this.prisma.site.findUnique({ where: { slug } });
    if (slugExists) throw new ConflictException('站点标识已存在，请更换');

    const domain = optionalText(dto.domain);
    if (domain) {
      const domainExists = await this.prisma.site.findUnique({ where: { domain } });
      if (domainExists) throw new ConflictException('域名已被其他站点占用');
    }

    const site = await this.prisma.site.create({
      data: {
        name: dto.name.trim(),
        slug,
        domain,
        themeKey: dto.themeKey ?? 'modern',
        logo: optionalText(dto.logo),
        description: optionalText(dto.description),
        seoTitle: optionalText(dto.seoTitle),
        seoKeywords: optionalText(dto.seoKeywords),
        seoDescription: optionalText(dto.seoDescription),
        status: dto.status ?? 'enabled',
        settings: dto.settings ? JSON.stringify(dto.settings) : null,
      },
    });

    await this.audit.log(req, {
      action: 'site.create',
      resource: 'site',
      resourceId: site.id,
      detail: { name: site.name, slug: site.slug },
    });
    return toSiteDto(site);
  }

  async update(id: string, dto: UpdateSiteDto, req: AuthenticatedRequest): Promise<Site> {
    const current = await this.prisma.site.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('站点不存在');

    const data: Prisma.SiteUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug !== current.slug) {
        const exists = await this.prisma.site.findUnique({ where: { slug } });
        if (exists) throw new ConflictException('站点标识已存在，请更换');
        data.slug = slug;
      }
    }

    if (dto.domain !== undefined) {
      const domain = optionalText(dto.domain);
      if (domain && domain !== current.domain) {
        const exists = await this.prisma.site.findUnique({ where: { domain } });
        if (exists) throw new ConflictException('域名已被其他站点占用');
      }
      data.domain = domain;
    }

    if (dto.themeKey !== undefined) data.themeKey = dto.themeKey;
    if (dto.logo !== undefined) data.logo = optionalText(dto.logo);
    if (dto.description !== undefined) data.description = optionalText(dto.description);
    if (dto.seoTitle !== undefined) data.seoTitle = optionalText(dto.seoTitle);
    if (dto.seoKeywords !== undefined) data.seoKeywords = optionalText(dto.seoKeywords);
    if (dto.seoDescription !== undefined) data.seoDescription = optionalText(dto.seoDescription);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.settings !== undefined) data.settings = JSON.stringify(dto.settings);

    const site = await this.prisma.site.update({ where: { id }, data });
    await this.audit.log(req, {
      action: 'site.update',
      resource: 'site',
      resourceId: site.id,
      detail: { name: site.name, slug: site.slug },
    });
    return toSiteDto(site);
  }

  async remove(id: string, req: AuthenticatedRequest): Promise<null> {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('站点不存在');

    const articleCount = await this.prisma.article.count({ where: { siteId: id } });
    if (articleCount > 0) {
      throw new BadRequestException('该站点下存在文章，无法删除');
    }

    await this.prisma.site.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'site.delete',
      resource: 'site',
      resourceId: id,
      detail: { name: site.name, slug: site.slug },
    });
    return null;
  }
}
