import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  NovelCard,
  NovelCatalog,
  NovelDetail,
  NovelVolume,
  Paginated,
} from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types';
import { sanitizePlainText, escapeXml } from '../../common/utils/sanitize.util';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import { SitesService, toPublicSite } from '../sites/sites.service';
import type { BatchNovelDto } from './dto/batch-novel.dto';
import type { CreateNovelDto } from './dto/create-novel.dto';
import type { CreateVolumeDto } from './dto/create-volume.dto';
import type { PublicNovelQueryDto } from './dto/public-novel-query.dto';
import type { PublicRankingQueryDto } from './dto/public-ranking-query.dto';
import type { PublicNovelSearchQueryDto } from './dto/public-search-query.dto';
import type { QueryNovelDto } from './dto/query-novel.dto';
import type { ReviewNovelDto } from './dto/review-novel.dto';
import type { UpdateNovelDto } from './dto/update-novel.dto';
import type { UpdateVolumeDto } from './dto/update-volume.dto';
import {
  adminNovelDetailInclude,
  chapterRefSelect,
  chapterSummarySelect,
  novelListInclude,
  publicNovelInclude,
  toChapterSummary,
  toLatestChapterRef,
  toNovelCard,
  type AdminNovelDetailRow,
  type ChapterRefRow,
  type NovelRow,
  type PublicNovelRow,
} from './novel.mapper';

/** 未分卷章节在前端目录中的伪分卷 ID */
const UNASSIGNED_VOLUME_ID = '__unassigned__';

/** sitemaps.org 规范：单个 sitemap 文件最多 50000 条 URL */
const SITEMAP_MAX_URLS = 50_000;
/** 分类等轻量条目上限（防止异常数据挤占书籍/章节预算） */
const SITEMAP_MAX_CATEGORIES = 5_000;

function textOrNull(value: string | null | undefined, max: number): string | null {
  if (value === undefined || value === null) return null;
  const cleaned = sanitizePlainText(value, max);
  return cleaned.length ? cleaned : null;
}

@Injectable()
export class NovelsService {
  private readonly logger = new Logger(NovelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
    private readonly sites: SitesService,
    private readonly config: ConfigService,
  ) {}

  /* ------------------------------- 管理端 ------------------------------- */

  async list(query: QueryNovelDto, siteId: string): Promise<Paginated<NovelCard>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.NovelWhereInput = { siteId };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.auditStatus) where.auditStatus = query.auditStatus;
    if (query.isRecommend !== undefined) where.isRecommend = query.isRecommend;
    if (query.isTop !== undefined) where.isTop = query.isTop;
    if (query.authorId) where.authorId = query.authorId;

    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { authorName: { contains: keyword, mode: 'insensitive' } },
        { slug: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy ?? 'updatedAt';
    const order = query.order ?? 'desc';
    const orderBy = { [sortBy]: order } as Prisma.NovelOrderByWithRelationInput;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.novel.count({ where }),
      this.prisma.novel.findMany({ where, skip, take, orderBy, include: novelListInclude }),
    ]);
    return paginate(rows.map(toNovelCard), total, page, pageSize);
  }

  /** 书籍详情（含全部分卷与章节，供管理端编辑页使用） */
  async findOne(id: string, siteId: string): Promise<NovelDetail> {
    const row = await this.prisma.novel.findFirst({
      where: { id, siteId },
      include: adminNovelDetailInclude,
    });
    if (!row) throw new NotFoundException('书籍不存在');

    const [latestRow, firstRow, commentCount] = await Promise.all([
      this.prisma.chapter.findFirst({
        where: { novelId: id, status: 'published' },
        orderBy: { chapterNo: 'desc' },
        select: chapterRefSelect,
      }),
      this.prisma.chapter.findFirst({
        where: { novelId: id, status: 'published' },
        orderBy: { chapterNo: 'asc' },
        select: chapterRefSelect,
      }),
      this.prisma.novelComment.count({ where: { novelId: id, status: 'approved' } }),
    ]);

    return this.toNovelDetail(row, latestRow, firstRow, commentCount);
  }

  async create(
    dto: CreateNovelDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<NovelCard> {
    const category = dto.categoryId
      ? await this.assertCategory(dto.categoryId, siteId)
      : null;
    const authorId = dto.authorId ? await this.assertMember(dto.authorId, siteId) : null;

    const title = sanitizePlainText(dto.title, 120);
    if (!title) throw new BadRequestException('书名不能为空');
    const authorName = sanitizePlainText(dto.authorName, 60);
    if (!authorName) throw new BadRequestException('作者笔名不能为空');

    let summary = textOrNull(dto.summary, 2000);
    let seoTitle = textOrNull(dto.seoTitle, 200);
    let seoDescription = textOrNull(dto.seoDescription, 500);

    // 插件钩子：novel.beforeCreate（补全简介、生成 SEO 建议）
    const hookResult = await this.pluginHost.runHook('novel.beforeCreate', {
      title,
      summary,
      cover: dto.cover ?? null,
      authorName,
      categoryName: category?.name ?? null,
      seoTitle,
      seoDescription,
    });
    if (!summary && typeof hookResult.summary === 'string' && hookResult.summary.trim()) {
      summary = sanitizePlainText(hookResult.summary, 2000);
    }
    if (!seoTitle && typeof hookResult.seoTitle === 'string' && hookResult.seoTitle.trim()) {
      seoTitle = sanitizePlainText(hookResult.seoTitle, 200);
    }
    if (
      !seoDescription &&
      typeof hookResult.seoDescription === 'string' &&
      hookResult.seoDescription.trim()
    ) {
      seoDescription = sanitizePlainText(hookResult.seoDescription, 500);
    }

    const slug = await this.resolveSlug(dto.slug, title, siteId);
    const auditStatus = dto.auditStatus ?? 'published';

    // 并发创建同名 slug 时唯一约束会抛 P2002，统一转 409（预检查无法覆盖竞态）
    const row = await this.guardSlugConflict(() =>
      this.prisma.novel.create({
        data: {
          siteId,
          categoryId: dto.categoryId ?? null,
          authorId,
          authorName,
          title,
          slug,
          cover: textOrNull(dto.cover, 500),
          summary,
          status: dto.status ?? 'serial',
          auditStatus,
          isRecommend: dto.isRecommend ?? false,
          isTop: dto.isTop ?? false,
          vipOnly: dto.vipOnly ?? false,
          publishedAt: auditStatus === 'published' ? new Date() : null,
          seoTitle,
          seoKeywords: textOrNull(dto.seoKeywords, 500),
          seoDescription,
        },
        include: novelListInclude,
      }),
    );

    await this.audit.log(req, {
      action: 'novel.create',
      resource: 'novel',
      resourceId: row.id,
      detail: {
        title: row.title,
        slug: row.slug,
        auditStatus,
        seoWarnings: hookResult.seoWarnings ?? null,
      },
    });
    return toNovelCard(row);
  }

  async update(
    id: string,
    dto: UpdateNovelDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<NovelCard> {
    const current = await this.prisma.novel.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('书籍不存在');

    if (dto.categoryId) await this.assertCategory(dto.categoryId, siteId);

    const data: Prisma.NovelUncheckedUpdateInput = {};

    if (dto.title !== undefined) {
      const title = sanitizePlainText(dto.title, 120);
      if (!title) throw new BadRequestException('书名不能为空');
      data.title = title;
    }
    if (dto.authorName !== undefined) {
      const authorName = sanitizePlainText(dto.authorName, 60);
      if (!authorName) throw new BadRequestException('作者笔名不能为空');
      data.authorName = authorName;
    }
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId ?? null;
    if (dto.cover !== undefined) data.cover = textOrNull(dto.cover, 500);
    if (dto.summary !== undefined) data.summary = textOrNull(dto.summary, 2000);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.auditStatus !== undefined) {
      data.auditStatus = dto.auditStatus;
      if (dto.auditStatus === 'published' && !current.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    if (dto.isRecommend !== undefined) data.isRecommend = dto.isRecommend;
    if (dto.isTop !== undefined) data.isTop = dto.isTop;
    if (dto.vipOnly !== undefined) data.vipOnly = dto.vipOnly;
    if (dto.seoTitle !== undefined) data.seoTitle = textOrNull(dto.seoTitle, 200);
    if (dto.seoKeywords !== undefined) data.seoKeywords = textOrNull(dto.seoKeywords, 500);
    if (dto.seoDescription !== undefined) {
      data.seoDescription = textOrNull(dto.seoDescription, 500);
    }
    if (dto.authorId !== undefined) {
      data.authorId = dto.authorId ? await this.assertMember(dto.authorId, siteId) : null;
    }
    if (dto.slug !== undefined || dto.title !== undefined) {
      const title = (data.title as string | undefined) ?? current.title;
      data.slug = await this.resolveSlug(dto.slug, title, siteId, current.slug);
    }

    const row = await this.guardSlugConflict(() =>
      this.prisma.novel.update({
        where: { id },
        data,
        include: novelListInclude,
      }),
    );

    await this.audit.log(req, {
      action: 'novel.update',
      resource: 'novel',
      resourceId: row.id,
      detail: { title: row.title, slug: row.slug, auditStatus: row.auditStatus },
    });
    return toNovelCard(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const current = await this.prisma.novel.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('书籍不存在');

    await this.prisma.novel.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'novel.delete',
      resource: 'novel',
      resourceId: id,
      detail: { title: current.title, slug: current.slug },
    });
    return null;
  }

  async review(
    id: string,
    dto: ReviewNovelDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<NovelCard> {
    const current = await this.prisma.novel.findFirst({ where: { id, siteId } });
    if (!current) throw new NotFoundException('书籍不存在');

    const data: Prisma.NovelUpdateInput = { auditStatus: dto.auditStatus };
    if (dto.auditStatus === 'published' && !current.publishedAt) {
      data.publishedAt = new Date();
    }
    const row = await this.prisma.novel.update({
      where: { id },
      data,
      include: novelListInclude,
    });

    await this.audit.log(req, {
      action: 'novel.review',
      resource: 'novel',
      resourceId: row.id,
      detail: { auditStatus: dto.auditStatus, reason: dto.reason ?? null, title: row.title },
    });
    return toNovelCard(row);
  }

  async batch(
    dto: BatchNovelDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<{ affected: number }> {
    const rows = await this.prisma.novel.findMany({
      where: { id: { in: dto.ids }, siteId },
      select: { id: true, publishedAt: true },
    });
    const ids = rows.map((row) => row.id);
    if (!ids.length) return { affected: 0 };

    let affected = 0;
    switch (dto.action) {
      case 'delete': {
        const result = await this.prisma.novel.deleteMany({ where: { id: { in: ids } } });
        affected = result.count;
        break;
      }
      case 'publish': {
        const now = new Date();
        await this.prisma.$transaction(
          rows.map((row) =>
            this.prisma.novel.update({
              where: { id: row.id },
              data: { auditStatus: 'published', publishedAt: row.publishedAt ?? now },
            }),
          ),
        );
        affected = rows.length;
        break;
      }
      case 'offline': {
        const result = await this.prisma.novel.updateMany({
          where: { id: { in: ids } },
          data: { auditStatus: 'offline' },
        });
        affected = result.count;
        break;
      }
      case 'recommend':
      case 'unrecommend': {
        const result = await this.prisma.novel.updateMany({
          where: { id: { in: ids } },
          data: { isRecommend: dto.action === 'recommend' },
        });
        affected = result.count;
        break;
      }
      default: {
        throw new BadRequestException('不支持的批量操作类型');
      }
    }

    await this.audit.log(req, {
      action: 'novel.batch',
      resource: 'novel',
      resourceId: null,
      detail: { action: dto.action, ids, affected },
    });
    return { affected };
  }

  /* -------------------------------- 分卷 -------------------------------- */

  async listVolumes(novelId: string, siteId: string): Promise<NovelVolume[]> {
    await this.assertNovel(novelId, siteId);
    const rows = await this.prisma.volume.findMany({
      where: { novelId },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      include: {
        chapters: { orderBy: { chapterNo: 'asc' }, select: chapterSummarySelect },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      novelId: row.novelId,
      title: row.title,
      sort: row.sort,
      chapters: row.chapters.map(toChapterSummary),
    }));
  }

  async createVolume(
    novelId: string,
    dto: CreateVolumeDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<NovelVolume> {
    await this.assertNovel(novelId, siteId);
    let sort = dto.sort;
    if (sort === undefined) {
      const last = await this.prisma.volume.findFirst({
        where: { novelId },
        orderBy: { sort: 'desc' },
        select: { sort: true },
      });
      sort = (last?.sort ?? -1) + 1;
    }
    const row = await this.prisma.volume.create({
      data: {
        novelId,
        title: sanitizePlainText(dto.title, 100) || '未命名分卷',
        sort,
      },
    });
    await this.audit.log(req, {
      action: 'volume.create',
      resource: 'volume',
      resourceId: row.id,
      detail: { novelId, title: row.title, sort: row.sort },
    });
    return { id: row.id, novelId: row.novelId, title: row.title, sort: row.sort, chapters: [] };
  }

  async updateVolume(
    id: string,
    dto: UpdateVolumeDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<NovelVolume> {
    const current = await this.findVolumeOrThrow(id, siteId);
    const data: Prisma.VolumeUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = sanitizePlainText(dto.title, 100) || '未命名分卷';
    }
    if (dto.sort !== undefined) data.sort = dto.sort;

    await this.prisma.volume.update({ where: { id }, data });
    const row = await this.prisma.volume.findUniqueOrThrow({
      where: { id },
      include: {
        chapters: { orderBy: { chapterNo: 'asc' }, select: chapterSummarySelect },
      },
    });
    await this.audit.log(req, {
      action: 'volume.update',
      resource: 'volume',
      resourceId: id,
      detail: { novelId: current.novelId, title: row.title, sort: row.sort },
    });
    return {
      id: row.id,
      novelId: row.novelId,
      title: row.title,
      sort: row.sort,
      chapters: row.chapters.map(toChapterSummary),
    };
  }

  async removeVolume(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const current = await this.findVolumeOrThrow(id, siteId);
    await this.prisma.volume.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'volume.delete',
      resource: 'volume',
      resourceId: id,
      detail: { novelId: current.novelId, title: current.title },
    });
    return null;
  }

  /* -------------------------------- 门户 -------------------------------- */

  async publicList(
    siteSlug: string,
    query: PublicNovelQueryDto,
  ): Promise<Paginated<NovelCard>> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.NovelWhereInput = { siteId: site.id, auditStatus: 'published' };

    if (query.status) where.status = query.status;
    if (query.isRecommend !== undefined) where.isRecommend = query.isRecommend;
    if (query.isTop !== undefined) where.isTop = query.isTop;

    const keyword = query.keyword?.trim();
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { authorName: { contains: keyword, mode: 'insensitive' } },
        { summary: { contains: keyword, mode: 'insensitive' } },
      ];
    }

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

    const sortBy = query.sortBy ?? 'updatedAt';
    const order = query.order ?? 'desc';
    const orderBy = [
      { [sortBy]: order } as Prisma.NovelOrderByWithRelationInput,
      { updatedAt: 'desc' } as Prisma.NovelOrderByWithRelationInput,
    ];

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.novel.count({ where }),
      this.prisma.novel.findMany({ where, skip, take, orderBy, include: novelListInclude }),
    ]);
    return paginate(rows.map(toNovelCard), total, page, pageSize);
  }

  /** 门户书籍详情（可选会员身份：书架/进度/已解锁章节） */
  async publicDetail(
    siteSlug: string,
    novelSlug: string,
    memberId?: string,
  ): Promise<NovelDetail> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const row = await this.prisma.novel.findFirst({
      where: { siteId: site.id, slug: novelSlug, auditStatus: 'published' },
      include: publicNovelInclude,
    });
    if (!row) throw new NotFoundException('书籍不存在或已下架');

    const [firstRow, commentCount] = await Promise.all([
      this.prisma.chapter.findFirst({
        where: { novelId: row.id, status: 'published' },
        orderBy: { chapterNo: 'asc' },
        select: chapterRefSelect,
      }),
      this.prisma.novelComment.count({ where: { novelId: row.id, status: 'approved' } }),
    ]);
    const volumes = await this.buildPublicVolumes(row.id, row.volumes);

    const detail: NovelDetail = {
      ...toNovelCard(row),
      seoTitle: row.seoTitle,
      seoKeywords: row.seoKeywords,
      seoDescription: row.seoDescription,
      volumes,
      firstChapter: toLatestChapterRef(firstRow),
      commentCount,
    };

    if (memberId) {
      const [shelf, progress, unlocks] = await Promise.all([
        this.prisma.bookshelf.findUnique({
          where: { memberId_novelId: { memberId, novelId: row.id } },
          select: { id: true },
        }),
        this.prisma.readingProgress.findUnique({
          where: { memberId_novelId: { memberId, novelId: row.id } },
          select: { chapterId: true, chapterNo: true, percent: true, updatedAt: true },
        }),
        this.prisma.chapterUnlock.findMany({
          where: {
            memberId,
            // 章节仍存在：按章节归属本书；章节已删除（chapterId 置空）：按快照 novelId 归属本书
            OR: [{ chapter: { novelId: row.id } }, { novelId: row.id }],
          },
          select: { chapterId: true, chapterNo: true },
        }),
      ]);
      detail.inBookshelf = shelf !== null;
      detail.progress = progress
        ? {
            chapterId: progress.chapterId,
            chapterNo: progress.chapterNo,
            percent: progress.percent,
            updatedAt: progress.updatedAt.toISOString(),
          }
        : null;
      // 已购章节：chapterId 命中现存章节的直接回传；快照命中（章节被删除/重建后 id 变化或置空）
      // 按 chapterNo 映射回当前章节 id，保证目录页也显示「已购」
      const chapterIdByNo = new Map<number, string>();
      for (const volume of volumes) {
        for (const chapter of volume.chapters) {
          chapterIdByNo.set(chapter.chapterNo, chapter.id);
        }
      }
      const unlockedIds = new Set<string>();
      for (const unlock of unlocks) {
        if (unlock.chapterId) unlockedIds.add(unlock.chapterId);
        if (unlock.chapterNo !== null) {
          const currentChapterId = chapterIdByNo.get(unlock.chapterNo);
          if (currentChapterId) unlockedIds.add(currentChapterId);
        }
      }
      detail.unlockedChapterIds = Array.from(unlockedIds);
    }

    return detail;
  }

  async publicCatalog(siteSlug: string, novelSlug: string): Promise<NovelCatalog> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const row = await this.prisma.novel.findFirst({
      where: { siteId: site.id, slug: novelSlug, auditStatus: 'published' },
      include: publicNovelInclude,
    });
    if (!row) throw new NotFoundException('书籍不存在或已下架');

    const volumes = await this.buildPublicVolumes(row.id, row.volumes);
    const totalChapters = volumes.reduce((sum, volume) => sum + volume.chapters.length, 0);
    return {
      novel: { id: row.id, title: row.title, slug: row.slug, authorName: row.authorName },
      volumes,
      totalChapters,
    };
  }

  async rankings(siteSlug: string, query: PublicRankingQueryDto): Promise<NovelCard[]> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const type = query.type ?? 'hot';
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const primary: Prisma.NovelOrderByWithRelationInput =
      type === 'new'
        ? { publishedAt: 'desc' }
        : type === 'favorite'
          ? { favorites: 'desc' }
          : type === 'words'
            ? { words: 'desc' }
            : { views: 'desc' };

    const rows = await this.prisma.novel.findMany({
      where: { siteId: site.id, auditStatus: 'published' },
      orderBy: [primary, { updatedAt: 'desc' }],
      take: limit,
      include: novelListInclude,
    });
    return rows.map(toNovelCard);
  }

  async search(
    siteSlug: string,
    query: PublicNovelSearchQueryDto,
  ): Promise<Paginated<NovelCard>> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const { page, pageSize, skip, take } = normalizePage(query);
    const keyword = query.q?.trim();
    if (!keyword) return paginate([], 0, page, pageSize);

    const where: Prisma.NovelWhereInput = {
      siteId: site.id,
      auditStatus: 'published',
      OR: [
        { title: { contains: keyword } },
        { authorName: { contains: keyword } },
        { summary: { contains: keyword } },
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.novel.count({ where }),
      this.prisma.novel.findMany({
        where,
        skip,
        take,
        orderBy: [{ updatedAt: 'desc' }],
        include: novelListInclude,
      }),
    ]);
    return paginate(rows.map(toNovelCard), total, page, pageSize);
  }

  /* ------------------------------ SEO / 订阅 ------------------------------ */

  /** 小说站 sitemap.xml：首页/书库/排行/分类/书籍/章节/作者，并合并插件追加 URL */
  async sitemapXml(siteSlug: string): Promise<string> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const baseUrl = this.resolveBaseUrl();

    // take 兜底：即使超大站点也不会把全量数据读进内存
    const [novels, categories, chapters] = await Promise.all([
      this.prisma.novel.findMany({
        where: { siteId: site.id, auditStatus: 'published' },
        select: { slug: true, authorName: true },
        orderBy: { updatedAt: 'desc' },
        take: SITEMAP_MAX_URLS,
      }),
      this.prisma.category.findMany({
        where: { siteId: site.id, type: 'novel', status: 'enabled' },
        select: { slug: true },
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        take: SITEMAP_MAX_CATEGORIES,
      }),
      this.prisma.chapter.findMany({
        where: { status: 'published', novel: { siteId: site.id, auditStatus: 'published' } },
        select: { chapterNo: true, updatedAt: true, novel: { select: { slug: true } } },
        // 超出上限时按 updatedAt desc 截断：优先保留最新章节
        orderBy: { updatedAt: 'desc' },
        take: SITEMAP_MAX_URLS,
      }),
    ]);

    const lastmodByPath = new Map<string, string>();
    const urls: string[] = ['/', '/books', '/rank'];
    let truncated = 0;
    const pushWithinLimit = (path: string): boolean => {
      if (urls.length >= SITEMAP_MAX_URLS) {
        truncated += 1;
        return false;
      }
      urls.push(path);
      return true;
    };
    for (const category of categories) {
      pushWithinLimit(`/category/${category.slug}`);
    }
    for (const novel of novels) {
      pushWithinLimit(`/book/${novel.slug}`);
    }
    for (const chapter of chapters) {
      const path = `/read/${chapter.novel.slug}/${chapter.chapterNo}`;
      if (pushWithinLimit(path)) lastmodByPath.set(path, chapter.updatedAt.toISOString());
    }

    const authorNames = Array.from(
      new Set(novels.map((novel) => novel.authorName).filter(Boolean)),
    );

    // 插件钩子：public.sitemap（内置 sitemap-enhancer 追加分类/排行/作者 URL）
    const hookResult = await this.pluginHost.runHook('public.sitemap', {
      site: toPublicSite(site),
      urls: [...urls],
      categories: categories.map((row) => ({ slug: row.slug })),
      authors: authorNames.map((penName) => ({ penName })),
      rankings: true,
    });
    const extra = Array.isArray(hookResult.urls)
      ? (hookResult.urls as unknown[]).filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const merged = Array.from(new Set([...urls, ...extra]));
    // sitemaps.org 规范：单个 sitemap 文件最多 50000 条 URL；超出按 updatedAt desc 保留最新并告警
    const overflow = merged.length - SITEMAP_MAX_URLS;
    if (truncated > 0 || overflow > 0) {
      const reasons: string[] = [];
      if (truncated > 0) reasons.push(`查询结果按 updatedAt desc 截断 ${truncated} 条`);
      if (overflow > 0) reasons.push(`合并去重后超出 ${overflow} 条`);
      this.logger.warn(
        `sitemap 达到 ${SITEMAP_MAX_URLS} 条上限（${reasons.join('，')}）：site=${site.slug}`,
      );
    }
    const limited = merged.slice(0, SITEMAP_MAX_URLS);

    const body = limited
      .map((path) => {
        const relative = path.startsWith('/') ? path : `/${path}`;
        const loc = escapeXml(`${baseUrl}${relative}`);
        const lastmod = lastmodByPath.get(relative);
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

  /** 最新章节 RSS 2.0（最近 20 章） */
  async rssXml(siteSlug: string): Promise<string> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const baseUrl = this.resolveBaseUrl();

    const chapters = await this.prisma.chapter.findMany({
      where: { status: 'published', novel: { siteId: site.id, auditStatus: 'published' } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        chapterNo: true,
        title: true,
        publishedAt: true,
        createdAt: true,
        novel: { select: { title: true, slug: true, summary: true } },
      },
    });

    const lastBuildDate = chapters[0]?.publishedAt ?? new Date();
    const items = chapters
      .map((chapter) => {
        const link = `${baseUrl}/read/${chapter.novel.slug}/${chapter.chapterNo}`;
        const title = `${chapter.novel.title} · ${chapter.title}`;
        const description = chapter.novel.summary ?? chapter.title;
        const pubDate = (chapter.publishedAt ?? chapter.createdAt).toUTCString();
        return [
          '    <item>',
          `      <title>${escapeXml(title)}</title>`,
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
      `    <description>${escapeXml(
        site.seoDescription ?? site.description ?? site.name,
      )}</description>`,
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

  /** slug 唯一冲突（并发创建/改名）统一转 409：resolveSlug 的预检查覆盖不到竞态 */
  private async guardSlugConflict<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('书籍 slug 已存在，请更换后重试');
      }
      throw error;
    }
  }

  private resolveBaseUrl(): string {
    const base = this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:4000';
    return base.replace(/\/+$/, '');
  }

  private toNovelDetail(
    row: AdminNovelDetailRow,
    latestRow: ChapterRefRow | null,
    firstRow: ChapterRefRow | null,
    commentCount: number,
  ): NovelDetail {
    const volumes: NovelVolume[] = row.volumes.map((volume) => ({
      id: volume.id,
      novelId: volume.novelId,
      title: volume.title,
      sort: volume.sort,
      chapters: volume.chapters.map(toChapterSummary),
    }));
    return {
      ...toNovelCard({ ...row, chapters: latestRow ? [latestRow] : [] }),
      seoTitle: row.seoTitle,
      seoKeywords: row.seoKeywords,
      seoDescription: row.seoDescription,
      volumes,
      firstChapter: toLatestChapterRef(firstRow),
      commentCount,
    };
  }

  /** 类型辅助（仅用于 toNovelDetail 的参数推导） */
  private async buildPublicVolumes(
    novelId: string,
    volumeRows: PublicNovelRow['volumes'],
  ): Promise<NovelVolume[]> {
    const volumes: NovelVolume[] = volumeRows.map((volume) => ({
      id: volume.id,
      novelId: volume.novelId,
      title: volume.title,
      sort: volume.sort,
      chapters: volume.chapters.map(toChapterSummary),
    }));
    const unassigned = await this.prisma.chapter.findMany({
      where: { novelId, volumeId: null, status: 'published' },
      orderBy: { chapterNo: 'asc' },
      select: chapterSummarySelect,
    });
    if (unassigned.length) {
      volumes.unshift({
        id: UNASSIGNED_VOLUME_ID,
        novelId,
        title: '正文',
        sort: -1,
        chapters: unassigned.map(toChapterSummary),
      });
    }
    return volumes;
  }

  private async assertNovel(novelId: string, siteId: string): Promise<void> {
    const novel = await this.prisma.novel.findFirst({
      where: { id: novelId, siteId },
      select: { id: true },
    });
    if (!novel) throw new NotFoundException('书籍不存在或不属于当前站点');
  }

  private async assertCategory(categoryId: string, siteId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, siteId },
      select: { id: true, name: true, slug: true },
    });
    if (!category) throw new BadRequestException('分类不存在或不属于当前站点');
    return category;
  }

  private async assertMember(memberId: string, siteId: string): Promise<string> {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, siteId },
      select: { id: true },
    });
    if (!member) throw new BadRequestException('作者会员不存在或不属于当前站点');
    return member.id;
  }

  private async findVolumeOrThrow(id: string, siteId: string) {
    const volume = await this.prisma.volume.findUnique({ where: { id } });
    if (!volume) throw new NotFoundException('分卷不存在');
    const novel = await this.prisma.novel.findFirst({
      where: { id: volume.novelId, siteId },
      select: { id: true },
    });
    if (!novel) throw new NotFoundException('分卷不存在');
    return volume;
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
      const exists = await this.prisma.novel.findUnique({
        where: { siteId_slug: { siteId, slug } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('书籍 slug 已存在，请更换');
      return slug;
    }
    if (currentSlug) return currentSlug;
    return ensureUniqueSlug(slugify(title), async (candidate) => {
      const exists = await this.prisma.novel.findUnique({
        where: { siteId_slug: { siteId, slug: candidate } },
        select: { id: true },
      });
      return exists !== null;
    });
  }
}
