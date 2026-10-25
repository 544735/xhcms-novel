import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Tag as PrismaTag } from '@prisma/client';
import type { Paginated, Tag } from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import type { CreateTagDto } from './dto/create-tag.dto';
import type { QueryTagDto } from './dto/query-tag.dto';
import type { UpdateTagDto } from './dto/update-tag.dto';

interface TagCountRow extends PrismaTag {
  _count: { articles: number };
}

export function toTagDto(row: TagCountRow): Tag {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    slug: row.slug,
    articleCount: row._count.articles,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QueryTagDto, siteId: string): Promise<Paginated<Tag>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const keyword = query.keyword?.trim();
    const where = {
      siteId,
      ...(keyword
        ? { OR: [{ name: { contains: keyword } }, { slug: { contains: keyword } }] }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.tag.count({ where }),
      this.prisma.tag.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { articles: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(rows.map(toTagDto), total, page, pageSize);
  }

  async options(siteId: string): Promise<Tag[]> {
    const rows = await this.prisma.tag.findMany({
      where: { siteId },
      include: { _count: { select: { articles: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map(toTagDto);
  }

  async create(dto: CreateTagDto, siteId: string, req: AuthenticatedRequest): Promise<Tag> {
    const name = sanitizePlainText(dto.name, 40);
    if (!name) throw new BadRequestException('标签名称不能为空');

    const sameName = await this.prisma.tag.findFirst({ where: { siteId, name } });
    if (sameName) throw new ConflictException('标签名称已存在');

    let slug: string;
    const requested = dto.slug?.trim().toLowerCase();
    if (requested) {
      const exists = await this.prisma.tag.findUnique({
        where: { siteId_slug: { siteId, slug: requested } },
      });
      if (exists) throw new ConflictException('标签 slug 已存在，请更换');
      slug = requested;
    } else {
      slug = await ensureUniqueSlug(slugify(dto.name), async (candidate) => {
        const exists = await this.prisma.tag.findUnique({
          where: { siteId_slug: { siteId, slug: candidate } },
          select: { id: true },
        });
        return exists !== null;
      });
    }

    const row = await this.prisma.tag.create({
      data: { siteId, name, slug },
      include: { _count: { select: { articles: true } } },
    });
    await this.audit.log(req, {
      action: 'tag.create',
      resource: 'tag',
      resourceId: row.id,
      detail: { name: row.name, slug: row.slug },
    });
    return toTagDto(row);
  }

  async update(
    id: string,
    dto: UpdateTagDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<Tag> {
    const current = await this.prisma.tag.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('标签不存在');

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = sanitizePlainText(dto.name, 40);
      if (!name) throw new BadRequestException('标签名称不能为空');
      if (name !== current.name) {
        const sameName = await this.prisma.tag.findFirst({
          where: { siteId, name, id: { not: id } },
        });
        if (sameName) throw new ConflictException('标签名称已存在');
      }
      data.name = name;
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug !== current.slug) {
        const exists = await this.prisma.tag.findUnique({
          where: { siteId_slug: { siteId, slug } },
        });
        if (exists) throw new ConflictException('标签 slug 已存在，请更换');
        data.slug = slug;
      }
    }

    const row = await this.prisma.tag.update({
      where: { id },
      data,
      include: { _count: { select: { articles: true } } },
    });
    await this.audit.log(req, {
      action: 'tag.update',
      resource: 'tag',
      resourceId: row.id,
      detail: { name: row.name, slug: row.slug },
    });
    return toTagDto(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const current = await this.prisma.tag.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('标签不存在');

    await this.prisma.tag.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'tag.delete',
      resource: 'tag',
      resourceId: id,
      detail: { name: current.name, slug: current.slug },
    });
    return null;
  }
}
