import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category as PrismaCategory } from '@prisma/client';
import type {
  Category,
  CategoryNode,
  CategoryType,
  EntityStatus,
  PublicCategory,
  PublicPage,
} from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types';
import { sanitizeContent, sanitizePlainText } from '../../common/utils/sanitize.util';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import { SitesService } from '../sites/sites.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { QueryCategoryDto } from './dto/query-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

interface CategoryCountRow extends PrismaCategory {
  _count: { articles: number; novels: number };
}

/** 扁平栏目 → 树（入参需已按 sort 排序） */
export function buildCategoryTree(rows: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  for (const row of rows) map.set(row.id, { ...row, children: [] });

  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = map.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? map.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function toCategoryDto(row: CategoryCountRow): Category {
  return {
    id: row.id,
    siteId: row.siteId,
    parentId: row.parentId,
    name: row.name,
    slug: row.slug,
    type: row.type as CategoryType,
    description: row.description,
    icon: row.icon,
    sort: row.sort,
    status: row.status as EntityStatus,
    seoTitle: row.seoTitle,
    seoKeywords: row.seoKeywords,
    seoDescription: row.seoDescription,
    content: row.content,
    template: row.template,
    // 小说分类的 articleCount 语义为「本分类书籍数」（字段名保持不变以兼容旧前端）
    articleCount: row.type === 'novel' ? row._count.novels : row._count.articles,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sites: SitesService,
  ) {}

  async list(query: QueryCategoryDto, siteId: string): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: {
        siteId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { _count: { select: { articles: true, novels: true } } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toCategoryDto);
  }

  async tree(siteId: string): Promise<CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      where: { siteId },
      include: { _count: { select: { articles: true, novels: true } } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    return buildCategoryTree(rows.map(toCategoryDto));
  }

  async findOne(id: string, siteId: string): Promise<Category> {
    const row = await this.prisma.category.findFirst({
      where: { id, siteId },
      include: { _count: { select: { articles: true, novels: true } } },
    });
    if (!row) throw new NotFoundException('栏目不存在');
    return toCategoryDto(row);
  }

  async create(
    dto: CreateCategoryDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<Category> {
    await this.assertParent(dto.parentId, siteId);

    const name = sanitizePlainText(dto.name, 60);
    if (!name) throw new BadRequestException('栏目名称不能为空');

    let slug: string;
    const requested = dto.slug?.trim().toLowerCase();
    if (requested) {
      const exists = await this.prisma.category.findUnique({
        where: { siteId_slug: { siteId, slug: requested } },
      });
      if (exists) throw new ConflictException('栏目 slug 已存在，请更换');
      slug = requested;
    } else {
      slug = await ensureUniqueSlug(slugify(dto.name), async (candidate) => {
        const exists = await this.prisma.category.findUnique({
          where: { siteId_slug: { siteId, slug: candidate } },
          select: { id: true },
        });
        return exists !== null;
      });
    }

    const row = await this.prisma.category.create({
      data: {
        siteId,
        parentId: dto.parentId ?? null,
        name,
        slug,
        type: dto.type ?? 'article',
        description: dto.description ? sanitizePlainText(dto.description, 500) : null,
        icon: dto.icon ? sanitizePlainText(dto.icon, 200) : null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 'enabled',
        seoTitle: dto.seoTitle ? sanitizePlainText(dto.seoTitle, 200) : null,
        seoKeywords: dto.seoKeywords ? sanitizePlainText(dto.seoKeywords, 500) : null,
        seoDescription: dto.seoDescription ? sanitizePlainText(dto.seoDescription, 500) : null,
        content: dto.content ? sanitizeContent(dto.content) : null,
        template: dto.template ? sanitizePlainText(dto.template, 120) : null,
      },
      include: { _count: { select: { articles: true, novels: true } } },
    });

    await this.audit.log(req, {
      action: 'category.create',
      resource: 'category',
      resourceId: row.id,
      detail: { name: row.name, slug: row.slug, type: row.type },
    });
    return toCategoryDto(row);
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<Category> {
    const current = await this.prisma.category.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('栏目不存在');

    if (dto.parentId !== undefined) {
      await this.assertParent(dto.parentId, siteId, id);
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const name = sanitizePlainText(dto.name, 60);
      if (!name) throw new BadRequestException('栏目名称不能为空');
      data.name = name;
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim().toLowerCase();
      if (slug !== current.slug) {
        const exists = await this.prisma.category.findUnique({
          where: { siteId_slug: { siteId, slug } },
        });
        if (exists) throw new ConflictException('栏目 slug 已存在，请更换');
        data.slug = slug;
      }
    }

    if (dto.parentId !== undefined) data.parentId = dto.parentId ?? null;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.description !== undefined) {
      data.description = dto.description ? sanitizePlainText(dto.description, 500) : null;
    }
    if (dto.icon !== undefined) data.icon = dto.icon ? sanitizePlainText(dto.icon, 200) : null;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.seoTitle !== undefined) {
      data.seoTitle = dto.seoTitle ? sanitizePlainText(dto.seoTitle, 200) : null;
    }
    if (dto.seoKeywords !== undefined) {
      data.seoKeywords = dto.seoKeywords ? sanitizePlainText(dto.seoKeywords, 500) : null;
    }
    if (dto.seoDescription !== undefined) {
      data.seoDescription = dto.seoDescription
        ? sanitizePlainText(dto.seoDescription, 500)
        : null;
    }
    if (dto.content !== undefined) {
      data.content = dto.content ? sanitizeContent(dto.content) : null;
    }
    if (dto.template !== undefined) {
      data.template = dto.template ? sanitizePlainText(dto.template, 120) : null;
    }

    const row = await this.prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { articles: true, novels: true } } },
    });

    await this.audit.log(req, {
      action: 'category.update',
      resource: 'category',
      resourceId: row.id,
      detail: { name: row.name, slug: row.slug },
    });
    return toCategoryDto(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const current = await this.prisma.category.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('栏目不存在');

    const [children, articles, novels] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.article.count({ where: { categoryId: id } }),
      this.prisma.novel.count({ where: { categoryId: id } }),
    ]);
    if (children > 0 || articles > 0 || novels > 0) {
      throw new BadRequestException('该栏目下存在子栏目、文章或书籍，无法删除');
    }

    await this.prisma.category.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'category.delete',
      resource: 'category',
      resourceId: id,
      detail: { name: current.name, slug: current.slug },
    });
    return null;
  }

  /** 门户：仅启用中的栏目，嵌套结构 */
  async publicTree(siteSlug: string, type?: string): Promise<PublicCategory[]> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const rows = await this.prisma.category.findMany({
      where: {
        siteId: site.id,
        status: 'enabled',
        ...(type ? { type } : {}),
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    const map = new Map<string, PublicCategory>();
    for (const row of rows) {
      map.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        type: row.type as CategoryType,
        icon: row.icon,
        children: [],
      });
    }
    const roots: PublicCategory[] = [];
    for (const row of rows) {
      const node = map.get(row.id);
      if (!node) continue;
      const parent = row.parentId ? map.get(row.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  /** 门户：单页（page 类型栏目） */
  async publicPage(siteSlug: string, pageSlug: string): Promise<PublicPage> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const row = await this.prisma.category.findFirst({
      where: { siteId: site.id, slug: pageSlug, type: 'page', status: 'enabled' },
    });
    if (!row) throw new NotFoundException('页面不存在');
    return {
      id: row.id,
      title: row.name,
      slug: row.slug,
      content: row.content ? sanitizeContent(row.content) : null,
      seoTitle: row.seoTitle,
      seoKeywords: row.seoKeywords,
      seoDescription: row.seoDescription,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** 校验父栏目：同站点、存在、且不构成环 */
  private async assertParent(
    parentId: string | null | undefined,
    siteId: string,
    selfId?: string,
  ): Promise<void> {
    if (!parentId) return;
    if (selfId && parentId === selfId) {
      throw new BadRequestException('不能将栏目移动到自身或其子栏目下');
    }
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent || parent.siteId !== siteId) {
      throw new BadRequestException('父栏目不存在或不属于当前站点');
    }
    if (!selfId) return;

    const seen = new Set<string>();
    let cursor: string | null = parent.parentId;
    while (cursor) {
      if (cursor === selfId) {
        throw new BadRequestException('不能将栏目移动到自身或其子栏目下');
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const node: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }
}
