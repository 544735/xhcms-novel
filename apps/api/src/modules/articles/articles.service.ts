import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Article,
  ArticleBatchAction,
  ArticleListItem,
  ArticleStatus,
  Paginated,
  PublicArchiveGroup,
  PublicArticleCard,
  PublicArticleDetail,
  Tag,
  TocItem,
} from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import {
  escapeXml,
  estimateReadingTime,
  sanitizeContent,
  sanitizePlainText,
} from '../../common/utils/sanitize.util';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import { SitesService, toPublicSite } from '../sites/sites.service';
import type { BatchArticleDto } from './dto/batch-article.dto';
import type { CreateArticleDto } from './dto/create-article.dto';
import type { PublicArticleQueryDto } from './dto/public-article-query.dto';
import type { PublicSearchQueryDto } from './dto/public-search-query.dto';
import type { QueryArticleDto } from './dto/query-article.dto';
import type { UpdateArticleDto } from './dto/update-article.dto';

/* ----------------------------- 查询片段 / 映射 ----------------------------- */

export const articleInclude = {
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { username: true, nickname: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.ArticleInclude;

export type ArticleRow = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

function toArticleBase(row: ArticleRow): Omit<Article, 'content'> {
  return {
    id: row.id,
    siteId: row.siteId,
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    cover: row.cover,
    status: row.status as ArticleStatus,
    isTop: row.isTop,
    isRecommend: row.isRecommend,
    views: row.views,
    sort: row.sort,
    authorId: row.authorId,
    authorName: row.author ? (row.author.nickname ?? row.author.username) : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    seoTitle: row.seoTitle,
    seoKeywords: row.seoKeywords,
    seoDescription: row.seoDescription,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    tags: row.tags.map((item) => item.tag),
  };
}

export function toArticleDto(row: ArticleRow): Article {
  return { ...toArticleBase(row), content: row.content };
}

export function toArticleListItem(row: ArticleRow): ArticleListItem {
  return toArticleBase(row);
}

function toPublicCard(row: ArticleRow): PublicArticleCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    cover: row.cover,
    isTop: row.isTop,
    isRecommend: row.isRecommend,
    views: row.views,
    readingTime: estimateReadingTime(row.content),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    category: row.category,
    tags: row.tags.map((item) => item.tag),
  };
}

function textOrNull(value: string | null | undefined, max: number): string | null {
  if (value === undefined || value === null) return null;
  const cleaned = sanitizePlainText(value, max);
  return cleaned.length ? cleaned : null;
}

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
    private readonly sites: SitesService,
    private readonly config: ConfigService,
  ) {}

  /* ------------------------------- 管理端 ------------------------------- */

  async list(query: QueryArticleDto, siteId: string): Promise<Paginated<ArticleListItem>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.ArticleWhereInput = { siteId };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };
    if (query.status) where.status = query.status;
    if (query.isTop !== undefined) where.isTop = query.isTop;
    if (query.isRecommend !== undefined) where.isRecommend = query.isRecommend;
    if (query.authorId) where.authorId = query.authorId;

    const keyword = query.keyword?.trim();
    if (keyword) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { title: { contains: keyword } },
            { summary: { contains: keyword } },
            { slug: { contains: keyword } },
          ],
        },
      ];
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const orderBy = { [sortBy]: order } as Prisma.ArticleOrderByWithRelationInput;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({ where, skip, take, orderBy, include: articleInclude }),
    ]);
    return paginate(rows.map(toArticleListItem), total, page, pageSize);
  }

  async findOne(id: string, siteId: string): Promise<Article> {
    const row = await this.prisma.article.findFirst({
      where: { id, siteId },
      include: articleInclude,
    });
    if (!row) throw new NotFoundException('文章不存在');
    return toArticleDto(row);
  }

  async create(
    dto: CreateArticleDto,
    siteId: string,
    req: AuthenticatedRequest,
    auth: AuthContext,
  ): Promise<Article> {
    if (dto.categoryId) await this.assertCategory(dto.categoryId, siteId);

    const title = sanitizePlainText(dto.title, 200);
    if (!title) throw new BadRequestException('文章标题不能为空');

    const content = sanitizeContent(dto.content);
    let summary = textOrNull(dto.summary, 500);

    // 插件钩子：article.beforeCreate（可自动补摘要、输出 SEO 建议）
    const hookResult = await this.pluginHost.runHook('article.beforeCreate', {
      title,
      summary,
      content,
      cover: dto.cover ?? null,
      seoTitle: dto.seoTitle ?? null,
      seoDescription: dto.seoDescription ?? null,
    });
    if (!summary && typeof hookResult.summary === 'string' && hookResult.summary.trim()) {
      summary = sanitizePlainText(hookResult.summary, 500);
    }

    const slug = await this.resolveSlug(dto.slug, title, siteId);
    const status = dto.status ?? 'draft';
    const publishedAt = this.resolvePublishedAt(dto.publishedAt, status, null);
    const tagIds = await this.validateTagIds(dto.tagIds, siteId);

    const row = await this.prisma.article.create({
      data: {
        siteId,
        categoryId: dto.categoryId ?? null,
        title,
        slug,
        summary,
        content,
        cover: textOrNull(dto.cover, 500),
        status,
        isTop: dto.isTop ?? false,
        isRecommend: dto.isRecommend ?? false,
        sort: dto.sort ?? 0,
        authorId: auth.id,
        publishedAt,
        seoTitle: textOrNull(dto.seoTitle, 200),
        seoKeywords: textOrNull(dto.seoKeywords, 500),
        seoDescription: textOrNull(dto.seoDescription, 500),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: articleInclude,
    });

    await this.audit.log(req, {
      action: 'article.create',
      resource: 'article',
      resourceId: row.id,
      detail: { title: row.title, slug: row.slug, status: row.status },
    });
    return toArticleDto(row);
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<Article> {
    const current = await this.prisma.article.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('文章不存在');

    if (dto.categoryId) await this.assertCategory(dto.categoryId, siteId);

    const data: Prisma.ArticleUncheckedUpdateInput = {};

    if (dto.title !== undefined) {
      const title = sanitizePlainText(dto.title, 200);
      if (!title) throw new BadRequestException('文章标题不能为空');
      data.title = title;
    }
    if (dto.content !== undefined) data.content = sanitizeContent(dto.content);
    if (dto.summary !== undefined) data.summary = textOrNull(dto.summary, 500);
    if (dto.cover !== undefined) data.cover = textOrNull(dto.cover, 500);
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId ?? null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isTop !== undefined) data.isTop = dto.isTop;
    if (dto.isRecommend !== undefined) data.isRecommend = dto.isRecommend;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.seoTitle !== undefined) data.seoTitle = textOrNull(dto.seoTitle, 200);
    if (dto.seoKeywords !== undefined) data.seoKeywords = textOrNull(dto.seoKeywords, 500);
    if (dto.seoDescription !== undefined) {
      data.seoDescription = textOrNull(dto.seoDescription, 500);
    }

    if (dto.slug !== undefined || dto.title !== undefined) {
      const title = (data.title as string | undefined) ?? current.title;
      data.slug = await this.resolveSlug(dto.slug, title, siteId, current.slug);
    }

    if (dto.publishedAt !== undefined || dto.status !== undefined) {
      const status = (dto.status ?? current.status) as string;
      data.publishedAt = this.resolvePublishedAt(dto.publishedAt, status, current.publishedAt);
    }

    const tagIds =
      dto.tagIds !== undefined ? await this.validateTagIds(dto.tagIds, siteId) : undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.article.update({ where: { id }, data });
      if (tagIds !== undefined) {
        await tx.articleTag.deleteMany({ where: { articleId: id } });
        if (tagIds.length) {
          await tx.articleTag.createMany({
            data: tagIds.map((tagId) => ({ articleId: id, tagId })),
          });
        }
      }
      return tx.article.findUniqueOrThrow({ where: { id }, include: articleInclude });
    });

    await this.audit.log(req, {
      action: 'article.update',
      resource: 'article',
      resourceId: row.id,
      detail: { title: row.title, slug: row.slug, status: row.status },
    });
    return toArticleDto(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const current = await this.prisma.article.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('文章不存在');

    await this.prisma.article.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'article.delete',
      resource: 'article',
      resourceId: id,
      detail: { title: current.title, slug: current.slug },
    });
    return null;
  }

  async publish(id: string, siteId: string, req: AuthenticatedRequest): Promise<Article> {
    const current = await this.prisma.article.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('文章不存在');

    const row = await this.prisma.article.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: current.publishedAt ?? new Date(),
      },
      include: articleInclude,
    });

    await this.audit.log(req, {
      action: 'article.publish',
      resource: 'article',
      resourceId: row.id,
      detail: { title: row.title, slug: row.slug },
    });
    await this.pluginHost.runHook('article.afterPublish', {
      article: toArticleDto(row),
      siteId,
    });
    return toArticleDto(row);
  }

  async unpublish(id: string, siteId: string, req: AuthenticatedRequest): Promise<Article> {
    const current = await this.prisma.article.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('文章不存在');

    const row = await this.prisma.article.update({
      where: { id },
      data: { status: 'draft' },
      include: articleInclude,
    });

    await this.audit.log(req, {
      action: 'article.unpublish',
      resource: 'article',
      resourceId: row.id,
      detail: { title: row.title, slug: row.slug },
    });
    return toArticleDto(row);
  }

  async batch(
    dto: BatchArticleDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<{ affected: number }> {
    const rows = await this.prisma.article.findMany({
      where: { id: { in: dto.ids }, siteId },
      select: { id: true },
    });
    const ids = rows.map((row) => row.id);
    if (!ids.length) return { affected: 0 };

    let affected = 0;
    const action: ArticleBatchAction = dto.action;

    switch (action) {
      case 'delete': {
        const result = await this.prisma.article.deleteMany({ where: { id: { in: ids } } });
        affected = result.count;
        break;
      }
      case 'publish': {
        const targets = await this.prisma.article.findMany({
          where: { id: { in: ids } },
          select: { id: true, publishedAt: true },
        });
        const now = new Date();
        await this.prisma.$transaction(
          targets.map((target) =>
            this.prisma.article.update({
              where: { id: target.id },
              data: { status: 'published', publishedAt: target.publishedAt ?? now },
            }),
          ),
        );
        affected = targets.length;
        break;
      }
      case 'unpublish': {
        const result = await this.prisma.article.updateMany({
          where: { id: { in: ids } },
          data: { status: 'draft' },
        });
        affected = result.count;
        break;
      }
      case 'archive': {
        const result = await this.prisma.article.updateMany({
          where: { id: { in: ids } },
          data: { status: 'archived' },
        });
        affected = result.count;
        break;
      }
      case 'top':
      case 'untop': {
        const result = await this.prisma.article.updateMany({
          where: { id: { in: ids } },
          data: { isTop: action === 'top' },
        });
        affected = result.count;
        break;
      }
      case 'recommend':
      case 'unrecommend': {
        const result = await this.prisma.article.updateMany({
          where: { id: { in: ids } },
          data: { isRecommend: action === 'recommend' },
        });
        affected = result.count;
        break;
      }
      default: {
        throw new BadRequestException('不支持的批量操作类型');
      }
    }

    await this.audit.log(req, {
      action: 'article.batch',
      resource: 'article',
      resourceId: null,
      detail: { action, ids, affected },
    });
    return { affected };
  }

  /* -------------------------------- 门户 -------------------------------- */

  async publicList(
    siteSlug: string,
    query: PublicArticleQueryDto,
  ): Promise<Paginated<PublicArticleCard>> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.ArticleWhereInput = { siteId: site.id, status: 'published' };

    const and: Prisma.ArticleWhereInput[] = [];
    const keyword = query.keyword?.trim();
    if (keyword) {
      and.push({
        OR: [
          { title: { contains: keyword } },
          { summary: { contains: keyword } },
        ],
      });
    }
    if (query.featured) {
      and.push({ OR: [{ isTop: true }, { isRecommend: true }] });
    }
    if (and.length) where.AND = and;

    if (query.categorySlug) {
      const category = await this.prisma.category.findFirst({
        where: { siteId: site.id, slug: query.categorySlug, status: 'enabled' },
        select: { id: true },
      });
      if (!category) return paginate([], 0, page, pageSize);
      const children = await this.prisma.category.findMany({
        where: { parentId: category.id },
        select: { id: true },
      });
      where.categoryId = { in: [category.id, ...children.map((child) => child.id)] };
    }

    if (query.tagSlug) {
      const tag = await this.prisma.tag.findFirst({
        where: { siteId: site.id, slug: query.tagSlug },
        select: { id: true },
      });
      if (!tag) return paginate([], 0, page, pageSize);
      where.tags = { some: { tagId: tag.id } };
    }

    const orderBy: Prisma.ArticleOrderByWithRelationInput[] =
      query.sort === 'hot'
        ? [{ views: 'desc' }, { publishedAt: 'desc' }]
        : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({ where, skip, take, orderBy, include: articleInclude }),
    ]);
    return paginate(rows.map(toPublicCard), total, page, pageSize);
  }

  async publicDetail(siteSlug: string, slug: string): Promise<PublicArticleDetail> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const article = await this.prisma.article.findFirst({
      where: { siteId: site.id, slug, status: 'published' },
      include: articleInclude,
    });
    if (!article) throw new NotFoundException('文章不存在');

    await this.prisma.article.update({
      where: { id: article.id },
      data: { views: { increment: 1 } },
    });

    const sanitized = sanitizeContent(article.content);
    const hookResult = await this.pluginHost.runHook('article.beforeRender', {
      content: sanitized,
      article: { id: article.id, title: article.title, slug: article.slug },
      site: toPublicSite(site),
    });
    const content =
      typeof hookResult.content === 'string' ? hookResult.content : sanitized;
    const toc: TocItem[] = Array.isArray(hookResult.toc) ? (hookResult.toc as TocItem[]) : [];
    const readingTime =
      typeof hookResult.readingTime === 'number' && hookResult.readingTime > 0
        ? hookResult.readingTime
        : estimateReadingTime(sanitized);

    const tagIds = article.tags.map((item) => item.tag.id);
    const baseWhere: Prisma.ArticleWhereInput = {
      siteId: site.id,
      status: 'published',
      id: { not: article.id },
    };
    const selectRef = { id: true, title: true, slug: true } satisfies Prisma.ArticleSelect;

    const [prev, next, related, commentCount] = await Promise.all([
      article.publishedAt
        ? this.prisma.article.findFirst({
            where: { ...baseWhere, publishedAt: { lt: article.publishedAt } },
            orderBy: { publishedAt: 'desc' },
            select: selectRef,
          })
        : Promise.resolve(null),
      article.publishedAt
        ? this.prisma.article.findFirst({
            where: { ...baseWhere, publishedAt: { gt: article.publishedAt } },
            orderBy: { publishedAt: 'asc' },
            select: selectRef,
          })
        : Promise.resolve(null),
      this.findRelated(site.id, article.id, article.categoryId, tagIds),
      this.prisma.comment.count({ where: { articleId: article.id, status: 'approved' } }),
    ]);

    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      cover: article.cover,
      isTop: article.isTop,
      isRecommend: article.isRecommend,
      views: article.views + 1,
      readingTime,
      publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
      category: article.category,
      tags: article.tags.map((item) => item.tag),
      content,
      seoTitle: article.seoTitle,
      seoKeywords: article.seoKeywords,
      seoDescription: article.seoDescription,
      authorName: article.author
        ? (article.author.nickname ?? article.author.username)
        : null,
      toc,
      prev: prev ? { id: prev.id, title: prev.title, slug: prev.slug } : null,
      next: next ? { id: next.id, title: next.title, slug: next.slug } : null,
      related: related.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        cover: item.cover,
        publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
      })),
      commentCount,
    };
  }

  async publicTags(siteSlug: string): Promise<Tag[]> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const rows = await this.prisma.tag.findMany({
      where: { siteId: site.id },
      include: {
        _count: { select: { articles: { where: { article: { status: 'published' } } } } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      siteId: row.siteId,
      name: row.name,
      slug: row.slug,
      articleCount: row._count.articles,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async publicArchive(siteSlug: string): Promise<PublicArchiveGroup[]> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const rows = await this.prisma.article.findMany({
      where: { siteId: site.id, status: 'published', publishedAt: { not: null } },
      select: { publishedAt: true },
    });

    const tree = new Map<number, Map<number, number>>();
    for (const row of rows) {
      if (!row.publishedAt) continue;
      const year = row.publishedAt.getFullYear();
      const month = row.publishedAt.getMonth() + 1;
      const months = tree.get(year) ?? new Map<number, number>();
      months.set(month, (months.get(month) ?? 0) + 1);
      tree.set(year, months);
    }

    return Array.from(tree.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({
        year,
        months: Array.from(months.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([month, count]) => ({ month, count })),
      }));
  }

  async publicSearch(
    siteSlug: string,
    query: PublicSearchQueryDto,
  ): Promise<Paginated<PublicArticleCard>> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const { page, pageSize, skip, take } = normalizePage(query);
    const keyword = query.q?.trim();
    if (!keyword) return paginate([], 0, page, pageSize);

    const where: Prisma.ArticleWhereInput = {
      siteId: site.id,
      status: 'published',
      OR: [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { content: { contains: keyword } },
      ],
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip,
        take,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: articleInclude,
      }),
    ]);
    return paginate(rows.map(toPublicCard), total, page, pageSize);
  }

  /* ------------------------------ SEO 输出 ------------------------------ */

  async sitemapXml(siteSlug: string): Promise<string> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const baseUrl = this.resolveBaseUrl();

    const [articles, pages, categories, tags] = await Promise.all([
      this.prisma.article.findMany({
        where: { siteId: site.id, status: 'published' },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.category.findMany({
        where: { siteId: site.id, type: 'page', status: 'enabled' },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.category.findMany({
        where: { siteId: site.id, status: 'enabled' },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.tag.findMany({ where: { siteId: site.id }, select: { slug: true } }),
    ]);

    const lastmodByPath = new Map<string, string>();
    const urls: string[] = ['/'];
    lastmodByPath.set('/', site.updatedAt.toISOString());

    for (const article of articles) {
      const path = `/article/${article.slug}`;
      urls.push(path);
      lastmodByPath.set(path, article.updatedAt.toISOString());
    }
    for (const page of pages) {
      const path = `/page/${page.slug}`;
      urls.push(path);
      lastmodByPath.set(path, page.updatedAt.toISOString());
    }

    // 插件钩子：public.sitemap（内置 sitemap-enhancer 会追加栏目页/标签聚合页）
    const hookResult = await this.pluginHost.runHook('public.sitemap', {
      site: toPublicSite(site),
      urls: [...urls],
      categories: categories.map((row) => ({
        slug: row.slug,
        updatedAt: row.updatedAt.toISOString(),
      })),
      tags: tags.map((row) => ({ slug: row.slug })),
    });

    const extra = Array.isArray(hookResult.urls)
      ? (hookResult.urls as unknown[]).filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const merged = Array.from(new Set([...urls, ...extra]));

    const body = merged
      .map((path) => {
        const relative = path.startsWith('/') ? path : `/${path}`;
        const loc = escapeXml(`${baseUrl}${relative}`);
        const lastmod = lastmodByPath.get(path);
        return lastmod
          ? `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`
          : `  <url><loc>${loc}</loc></url>`;
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      body,
      '</urlset>',
      '',
    ].join('\n');
  }

  async rssXml(siteSlug: string): Promise<string> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const baseUrl = this.resolveBaseUrl();

    const articles = await this.prisma.article.findMany({
      where: { siteId: site.id, status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        seoDescription: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    const lastBuildDate = articles[0]?.publishedAt ?? new Date();
    const items = articles
      .map((article) => {
        const link = `${baseUrl}/article/${article.slug}`;
        const description = article.summary ?? article.seoDescription ?? article.title;
        const pubDate = (article.publishedAt ?? article.createdAt).toUTCString();
        return [
          '    <item>',
          `      <title>${escapeXml(article.title)}</title>`,
          `      <link>${escapeXml(link)}</link>`,
          `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
          `      <pubDate>${pubDate}</pubDate>`,
          `      <description>${escapeXml(description)}</description>`,
          '    </item>',
        ].join('\n');
      })
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '  <channel>',
      `    <title>${escapeXml(site.seoTitle ?? site.name)}</title>`,
      `    <link>${escapeXml(baseUrl)}</link>`,
      `    <description>${escapeXml(site.seoDescription ?? site.description ?? site.name)}</description>`,
      '    <language>zh-CN</language>',
      `    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`,
      items,
      '  </channel>',
      '</rss>',
      '',
    ]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  /* ------------------------------- 内部工具 ------------------------------- */

  private resolveBaseUrl(): string {
    const base = this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:4000';
    return base.replace(/\/+$/, '');
  }

  private async assertCategory(categoryId: string, siteId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, siteId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('栏目不存在或不属于当前站点');
  }

  private async resolveSlug(
    requested: string | undefined,
    title: string,
    siteId: string,
    currentSlug?: string,
  ): Promise<string> {
    if (requested) {
      const slug = requested.trim().toLowerCase();
      if (currentSlug && slug === currentSlug) return currentSlug;
      const exists = await this.prisma.article.findUnique({
        where: { siteId_slug: { siteId, slug } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('文章 slug 已存在，请更换');
      return slug;
    }
    if (currentSlug) return currentSlug;
    return ensureUniqueSlug(slugify(title), async (candidate) => {
      const exists = await this.prisma.article.findUnique({
        where: { siteId_slug: { siteId, slug: candidate } },
        select: { id: true },
      });
      return exists !== null;
    });
  }

  private resolvePublishedAt(
    input: string | null | undefined,
    status: string,
    current: Date | null,
  ): Date | null {
    if (input !== undefined) {
      if (input === null || input === '') return null;
      const parsed = new Date(input);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('发布时间格式不正确');
      }
      return parsed;
    }
    if (status === 'published') return current ?? new Date();
    return current;
  }

  private async validateTagIds(tagIds: string[] | undefined, siteId: string): Promise<string[]> {
    if (!tagIds?.length) return [];
    const unique = Array.from(new Set(tagIds));
    const rows = await this.prisma.tag.findMany({
      where: { id: { in: unique }, siteId },
      select: { id: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('存在无效的标签（不属于当前站点或已被删除）');
    }
    return unique;
  }

  private async findRelated(
    siteId: string,
    articleId: string,
    categoryId: string | null,
    tagIds: string[],
  ): Promise<
    { id: string; title: string; slug: string; cover: string | null; publishedAt: Date | null }[]
  > {
    const or: Prisma.ArticleWhereInput[] = [];
    if (categoryId) or.push({ categoryId });
    if (tagIds.length) or.push({ tags: { some: { tagId: { in: tagIds } } } });
    if (!or.length) return [];

    return this.prisma.article.findMany({
      where: { siteId, status: 'published', id: { not: articleId }, OR: or },
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
      take: 4,
      select: { id: true, title: true, slug: true, cover: true, publishedAt: true },
    });
  }
}
