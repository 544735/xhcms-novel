import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuthorNovelItem,
  AuthorProfile,
  AuthorStats,
  ChapterSummary,
  NovelCard,
  PageQuery,
  Paginated,
} from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import type { AuthenticatedRequest } from '../../common/types';
import { createChapterWithRetry, normalizeChapterPrice } from '../novels/novel.util';
import type {
  ApplyAuthorDto,
  CreateAuthorChapterDto,
  CreateAuthorNovelDto,
  QueryAuthorApplicationDto,
  QueryAuthorChapterDto,
  QueryAuthorNovelDto,
  ReviewAuthorApplicationDto,
  UpdateAuthorChapterDto,
  UpdateAuthorNovelDto,
} from './dto/author.dto';
import {
  countChapterWords,
  novelRefsInclude,
  recomputeNovelStats,
  requireActiveMember,
  resolveActiveSite,
  sanitizeChapterContent,
  startOfToday,
  toChapterSummary,
  toNovelCard,
} from './reader.util';

const AUTHOR_MEMBER_SELECT = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  siteId: true,
  username: true,
  nickname: true,
  email: true,
  status: true,
  avatar: true,
});

type AuthorProfileRow = Prisma.AuthorProfileGetPayload<{
  include: { member: { select: typeof AUTHOR_MEMBER_SELECT } };
}>;

/** 管理端作者申请条目（附带会员信息） */
export interface AdminAuthorApplication extends AuthorProfile {
  member: {
    id: string;
    username: string;
    nickname: string | null;
    email: string;
    status: string;
    avatar: string | null;
  };
}

/** 作者章节详情（含完整正文，供作者中心编辑草稿章节） */
export type AuthorChapterDetail = ChapterSummary & { content: string };

function toAuthorProfile(row: {
  id: string;
  memberId: string;
  penName: string;
  bio: string | null;
  status: string;
  contact: string | null;
  appliedAt: Date;
  reviewedAt: Date | null;
  rejectReason: string | null;
}): AuthorProfile {
  return {
    id: row.id,
    memberId: row.memberId,
    penName: row.penName,
    bio: row.bio,
    status: row.status as AuthorProfile['status'],
    contact: row.contact,
    appliedAt: row.appliedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    rejectReason: row.rejectReason,
  };
}

function toAdminApplication(row: AuthorProfileRow): AdminAuthorApplication {
  return {
    ...toAuthorProfile(row),
    member: {
      id: row.member.id,
      username: row.member.username,
      nickname: row.member.nickname,
      email: row.member.email,
      status: row.member.status,
      avatar: row.member.avatar,
    },
  };
}

/** 作者中心（会员）与公开作者页 */
@Injectable()
export class AuthorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
  ) {}

  /* ---------------------------- 作者申请 ---------------------------- */

  /** GET /public/sites/:slug/members/author */
  async getProfile(siteSlug: string, memberId: string): Promise<AuthorProfile | null> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const profile = await this.prisma.authorProfile.findUnique({ where: { memberId } });
    return profile ? toAuthorProfile(profile) : null;
  }

  /** POST /public/sites/:slug/members/author */
  async apply(siteSlug: string, memberId: string, dto: ApplyAuthorDto): Promise<AuthorProfile> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const existing = await this.prisma.authorProfile.findUnique({ where: { memberId } });
    if (existing) throw new ConflictException('您已提交过作者申请，请勿重复提交');

    const penName = sanitizePlainText(dto.penName, 30);
    if (!penName) throw new BadRequestException('笔名不能为空');

    const dupPenName = await this.prisma.authorProfile.findUnique({ where: { penName } });
    if (dupPenName) throw new ConflictException('该笔名已被占用，请更换');

    const profile = await this.prisma.authorProfile.create({
      data: {
        memberId,
        penName,
        bio: sanitizePlainText(dto.bio, 500) || null,
        contact: sanitizePlainText(dto.contact, 120) || null,
        status: 'pending',
      },
    });
    return toAuthorProfile(profile);
  }

  /* ---------------------------- 作者数据 ---------------------------- */

  /** GET /public/sites/:slug/members/author/stats */
  async stats(siteSlug: string, memberId: string): Promise<AuthorStats> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const profile = await this.prisma.authorProfile.findUnique({ where: { memberId } });
    if (!profile) throw new NotFoundException('尚未申请成为作者');

    return this.computeStats(site.id, { authorId: memberId });
  }

  /** 公开作者页 GET /public/sites/:slug/authors/:penName */
  async publicAuthorPage(
    siteSlug: string,
    penName: string,
  ): Promise<{
    penName: string;
    bio: string | null;
    stats: AuthorStats;
    novels: NovelCard[];
  }> {
    const site = await resolveActiveSite(this.prisma, siteSlug);

    const profile = await this.prisma.authorProfile.findUnique({
      where: { penName },
      include: { member: { select: AUTHOR_MEMBER_SELECT } },
    });
    if (!profile || profile.member.siteId !== site.id || profile.status !== 'approved') {
      throw new NotFoundException('作者不存在');
    }

    const novels = await this.prisma.novel.findMany({
      where: { siteId: site.id, authorName: profile.penName, auditStatus: 'published' },
      orderBy: { updatedAt: 'desc' },
      include: novelRefsInclude,
    });

    const stats = await this.computeStats(site.id, { authorName: profile.penName, publishedOnly: true });

    return {
      penName: profile.penName,
      bio: profile.bio,
      stats,
      novels: novels.map(toNovelCard),
    };
  }

  /* ---------------------------- 我的作品 ---------------------------- */

  /** GET /public/sites/:slug/members/author/novels */
  async listNovels(
    siteSlug: string,
    memberId: string,
    query: QueryAuthorNovelDto,
  ): Promise<Paginated<AuthorNovelItem>> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const where: Prisma.NovelWhereInput = { siteId: site.id, authorId: memberId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novel.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          ...novelRefsInclude,
          _count: { select: { chapters: { where: { status: 'draft' } } } },
        },
      }),
      this.prisma.novel.count({ where }),
    ]);

    const items: AuthorNovelItem[] = rows.map((row) => ({
      ...toNovelCard(row),
      pendingChapters: row._count.chapters,
    }));
    return paginate(items, total, page, pageSize);
  }

  /** POST /public/sites/:slug/members/author/novels（须 approved 作者；作品进入待审） */
  async createNovel(
    siteSlug: string,
    memberId: string,
    dto: CreateAuthorNovelDto,
  ): Promise<NovelCard> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);
    const profile = await this.requireApprovedAuthor(memberId);

    const category = await this.resolveCategory(site.id, dto.categoryId ?? null);

    const title = sanitizePlainText(dto.title, 120);
    if (!title) throw new BadRequestException('书名不能为空');

    // 插件钩子：补全简介 / SEO，返回运营建议（失败不影响创建）
    const hookResult = await this.pluginHost.runHook<{
      summary?: string;
      seoTitle?: string;
      seoDescription?: string;
      seoWarnings?: string[];
    }>('novel.beforeCreate', {
      title,
      summary: dto.summary ? sanitizePlainText(dto.summary, 2000) : null,
      cover: dto.cover ?? null,
      authorName: profile.penName,
      categoryName: category?.name ?? null,
    });

    const slug = await ensureUniqueSlug(
      slugify(dto.slug?.trim() || title),
      async (candidate) =>
        Boolean(
          await this.prisma.novel.findFirst({
            where: { siteId: site.id, slug: candidate },
            select: { id: true },
          }),
        ),
    );

    const summary = sanitizePlainText(dto.summary, 2000) || hookResult?.summary || null;
    const row = await this.prisma.novel.create({
      data: {
        siteId: site.id,
        categoryId: category?.id ?? null,
        authorId: memberId,
        authorName: profile.penName,
        title,
        slug,
        cover: dto.cover ?? null,
        summary,
        status: dto.status ?? 'serial',
        auditStatus: 'pending',
        isRecommend: false,
        isTop: false,
        vipOnly: dto.vipOnly ?? false,
        seoTitle: dto.seoTitle ? sanitizePlainText(dto.seoTitle, 120) : hookResult?.seoTitle ?? null,
        seoKeywords: dto.seoKeywords ? sanitizePlainText(dto.seoKeywords, 200) : null,
        seoDescription: dto.seoDescription
          ? sanitizePlainText(dto.seoDescription, 300)
          : hookResult?.seoDescription ?? null,
      },
      include: novelRefsInclude,
    });
    return toNovelCard(row);
  }

  /** PATCH /public/sites/:slug/members/author/novels/:id（仅本人作品；保持原审核状态） */
  async updateNovel(
    siteSlug: string,
    memberId: string,
    novelId: string,
    dto: UpdateAuthorNovelDto,
  ): Promise<NovelCard> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const existing = await this.prisma.novel.findFirst({
      where: { id: novelId, siteId: site.id, authorId: memberId },
      select: { id: true, slug: true },
    });
    if (!existing) throw new NotFoundException('作品不存在或无权操作');

    const data: Prisma.NovelUncheckedUpdateInput = {};
    if (dto.title !== undefined) {
      const title = sanitizePlainText(dto.title, 120);
      if (!title) throw new BadRequestException('书名不能为空');
      data.title = title;
    }
    if (dto.slug !== undefined) {
      data.slug = await ensureUniqueSlug(
        slugify(dto.slug?.trim() || 'novel'),
        async (candidate) =>
          Boolean(
            await this.prisma.novel.findFirst({
              where: { siteId: site.id, slug: candidate, id: { not: novelId } },
              select: { id: true },
            }),
          ),
      );
    }
    if (dto.categoryId !== undefined) {
      const category = await this.resolveCategory(site.id, dto.categoryId ?? null);
      data.categoryId = category?.id ?? null;
    }
    if (dto.cover !== undefined) data.cover = dto.cover;
    if (dto.summary !== undefined) {
      data.summary = dto.summary ? sanitizePlainText(dto.summary, 2000) : null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.vipOnly !== undefined) data.vipOnly = dto.vipOnly;
    if (dto.seoTitle !== undefined) {
      data.seoTitle = dto.seoTitle ? sanitizePlainText(dto.seoTitle, 120) : null;
    }
    if (dto.seoKeywords !== undefined) {
      data.seoKeywords = dto.seoKeywords ? sanitizePlainText(dto.seoKeywords, 200) : null;
    }
    if (dto.seoDescription !== undefined) {
      data.seoDescription = dto.seoDescription
        ? sanitizePlainText(dto.seoDescription, 300)
        : null;
    }

    const row = await this.prisma.novel.update({
      where: { id: existing.id },
      data,
      include: novelRefsInclude,
    });
    return toNovelCard(row);
  }

  /** DELETE /public/sites/:slug/members/author/novels/:id（级联删除章节/评论等） */
  async deleteNovel(siteSlug: string, memberId: string, novelId: string): Promise<null> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const existing = await this.prisma.novel.findFirst({
      where: { id: novelId, siteId: site.id, authorId: memberId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('作品不存在或无权操作');

    await this.prisma.novel.delete({ where: { id: existing.id } });
    return null;
  }

  /* ---------------------------- 我的章节 ---------------------------- */

  /** GET /public/sites/:slug/members/author/novels/:id/chapters */
  async listChapters(
    siteSlug: string,
    memberId: string,
    novelId: string,
    query: QueryAuthorChapterDto,
  ): Promise<Paginated<ChapterSummary>> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);
    await this.requireOwnNovel(site.id, memberId, novelId);

    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const where: Prisma.ChapterWhereInput = { novelId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chapter.findMany({
        where,
        orderBy: { chapterNo: 'asc' },
        skip,
        take,
      }),
      this.prisma.chapter.count({ where }),
    ]);

    return paginate(rows.map(toChapterSummary), total, page, pageSize);
  }

  /** POST /public/sites/:slug/members/author/novels/:id/chapters */
  async createChapter(
    siteSlug: string,
    memberId: string,
    novelId: string,
    dto: CreateAuthorChapterDto,
  ): Promise<ChapterSummary> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);
    const novel = await this.requireOwnNovel(site.id, memberId, novelId);

    const title = sanitizePlainText(dto.title, 120);
    if (!title) throw new BadRequestException('章节标题不能为空');
    const content = sanitizeChapterContent(dto.content);
    if (!content) throw new BadRequestException('章节正文不能为空');

    const volumeId = await this.resolveVolume(novelId, dto.volumeId ?? null);

    const isVip = Boolean(dto.isVip);
    // 统一口径：isVip => price>=1（未填回落默认价），非 VIP => price=0
    const price = normalizeChapterPrice(isVip, dto.price);
    // 书籍未上架（pending/rejected/offline）时章节只能存为草稿
    const published = novel.auditStatus === 'published' && dto.status !== 'draft';
    const status = published ? 'published' : 'draft';

    // 并发创建时由 (novelId, chapterNo) 唯一约束兜底，冲突自动重算序号重试
    const row = await createChapterWithRetry(this.prisma, novelId, (chapterNo) =>
      this.prisma.chapter.create({
        data: {
          novelId,
          volumeId,
          chapterNo,
          title,
          content,
          wordCount: countChapterWords(content),
          isVip,
          price,
          status,
          publishedAt: published ? new Date() : null,
        },
      }),
    );

    await recomputeNovelStats(this.prisma, novelId);
    if (published) {
      await this.pluginHost.runHook('chapter.afterPublish', {
        novelId,
        chapterId: row.id,
        chapterNo: row.chapterNo,
      });
    }
    return toChapterSummary(row);
  }

  /** PATCH /public/sites/:slug/members/author/novels/:id/chapters/:chapterId */
  async updateChapter(
    siteSlug: string,
    memberId: string,
    novelId: string,
    chapterId: string,
    dto: UpdateAuthorChapterDto,
  ): Promise<ChapterSummary> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);
    const novel = await this.requireOwnNovel(site.id, memberId, novelId);

    const existing = await this.prisma.chapter.findFirst({
      where: { id: chapterId, novelId },
      select: { id: true, status: true, isVip: true, price: true },
    });
    if (!existing) throw new NotFoundException('章节不存在或无权操作');

    const data: Prisma.ChapterUncheckedUpdateInput = {};
    if (dto.title !== undefined) {
      const title = sanitizePlainText(dto.title, 120);
      if (!title) throw new BadRequestException('章节标题不能为空');
      data.title = title;
    }
    if (dto.content !== undefined) {
      const content = sanitizeChapterContent(dto.content);
      if (!content) throw new BadRequestException('章节正文不能为空');
      data.content = content;
      data.wordCount = countChapterWords(content);
    }
    if (dto.volumeId !== undefined) {
      data.volumeId = await this.resolveVolume(novelId, dto.volumeId ?? null);
    }
    if (dto.isVip !== undefined || dto.price !== undefined) {
      const isVip = dto.isVip ?? existing.isVip;
      // 复用统一定价口径：避免只传 price 时留下「VIP 但 0 币」的免费章节
      data.isVip = isVip;
      data.price = normalizeChapterPrice(
        isVip,
        dto.price !== undefined ? dto.price : existing.price,
      );
    }

    if (dto.status !== undefined) {
      const nextStatus = novel.auditStatus === 'published' ? dto.status : 'draft';
      data.status = nextStatus;
      if (nextStatus === 'published' && existing.status !== 'published') {
        data.publishedAt = new Date();
      }
    }

    const row = await this.prisma.chapter.update({
      where: { id: existing.id },
      data,
    });

    await recomputeNovelStats(this.prisma, novelId);
    if (row.status === 'published' && existing.status !== 'published') {
      await this.pluginHost.runHook('chapter.afterPublish', {
        novelId,
        chapterId: row.id,
        chapterNo: row.chapterNo,
      });
    }
    return toChapterSummary(row);
  }

  /** GET /public/sites/:slug/members/author/novels/:id/chapters/:chapterId（含完整正文，作者无 VIP 限制） */
  async getChapter(
    siteSlug: string,
    memberId: string,
    novelId: string,
    chapterId: string,
  ): Promise<AuthorChapterDetail> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);
    await this.requireOwnNovel(site.id, memberId, novelId);

    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, novelId },
    });
    if (!chapter) throw new NotFoundException('章节不存在或无权操作');

    return { ...toChapterSummary(chapter), content: chapter.content };
  }

  /** DELETE /public/sites/:slug/members/author/novels/:id/chapters/:chapterId */
  async deleteChapter(
    siteSlug: string,
    memberId: string,
    novelId: string,
    chapterId: string,
  ): Promise<null> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);
    await this.requireOwnNovel(site.id, memberId, novelId);

    const existing = await this.prisma.chapter.findFirst({
      where: { id: chapterId, novelId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('章节不存在或无权操作');

    await this.prisma.chapter.delete({ where: { id: existing.id } });
    await recomputeNovelStats(this.prisma, novelId);
    return null;
  }

  /* ---------------------------- 管理端作者审核 ---------------------------- */

  /** GET /author-applications */
  async listApplications(
    siteId: string,
    query: QueryAuthorApplicationDto,
  ): Promise<Paginated<AdminAuthorApplication>> {
    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const where: Prisma.AuthorProfileWhereInput = {
      member: { siteId },
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.authorProfile.findMany({
        where,
        orderBy: { appliedAt: 'desc' },
        skip,
        take,
        include: { member: { select: AUTHOR_MEMBER_SELECT } },
      }),
      this.prisma.authorProfile.count({ where }),
    ]);

    return paginate(rows.map(toAdminApplication), total, page, pageSize);
  }

  /** POST /author-applications/:id/review */
  async reviewApplication(
    siteId: string,
    id: string,
    dto: ReviewAuthorApplicationDto,
    req?: AuthenticatedRequest,
  ): Promise<AuthorProfile> {
    const existing = await this.prisma.authorProfile.findFirst({
      where: { id, member: { siteId } },
    });
    if (!existing) throw new NotFoundException('作者申请不存在');

    const rejectReason =
      dto.status === 'rejected' ? sanitizePlainText(dto.reason, 200) || null : null;
    const row = await this.prisma.authorProfile.update({
      where: { id },
      data: { status: dto.status, reviewedAt: new Date(), rejectReason },
    });

    await this.audit.log(req, {
      action: 'author.review',
      resource: 'author_profile',
      resourceId: id,
      detail: { status: dto.status, reason: rejectReason, memberId: existing.memberId },
    });
    return toAuthorProfile(row);
  }

  /* ---------------------------- 内部工具 ---------------------------- */

  private async requireApprovedAuthor(memberId: string) {
    const profile = await this.prisma.authorProfile.findUnique({ where: { memberId } });
    if (!profile) throw new ForbiddenException('请先申请成为作者');
    if (profile.status !== 'approved') {
      throw new ForbiddenException('作者申请通过后才能创建作品');
    }
    return profile;
  }

  private async requireOwnNovel(siteId: string, memberId: string, novelId: string) {
    const novel = await this.prisma.novel.findFirst({
      where: { id: novelId, siteId, authorId: memberId },
      select: { id: true, auditStatus: true, title: true },
    });
    if (!novel) throw new NotFoundException('作品不存在或无权操作');
    return novel;
  }

  private async resolveCategory(siteId: string, categoryId: string | null) {
    if (!categoryId) return null;
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, siteId },
      select: { id: true, name: true },
    });
    if (!category) throw new BadRequestException('分类不存在');
    return category;
  }

  private async resolveVolume(novelId: string, volumeId: string | null): Promise<string | null> {
    if (!volumeId) return null;
    const volume = await this.prisma.volume.findFirst({
      where: { id: volumeId, novelId },
      select: { id: true },
    });
    if (!volume) throw new BadRequestException('分卷不存在');
    return volume.id;
  }

  /**
   * 作者数据统计：
   * - 按 authorId（会员本人）或 authorName（公开作者页）聚合作品；
   * - todayViews 当前数据模型未记录逐日 PV，使用「今日更新章节的累计浏览」近似。
   */
  private async computeStats(
    siteId: string,
    filter: { authorId?: string; authorName?: string; publishedOnly?: boolean },
  ): Promise<AuthorStats> {
    const novels = await this.prisma.novel.findMany({
      where: {
        siteId,
        ...(filter.authorId ? { authorId: filter.authorId } : {}),
        ...(filter.authorName ? { authorName: filter.authorName } : {}),
        ...(filter.publishedOnly ? { auditStatus: 'published' } : {}),
      },
      select: {
        id: true,
        words: true,
        views: true,
        favorites: true,
        chapterCount: true,
      },
    });

    const novelIds = novels.map((row) => row.id);
    const [chapterCount, todayViewsAgg] = await Promise.all([
      novelIds.length
        ? this.prisma.chapter.count({ where: { novelId: { in: novelIds } } })
        : Promise.resolve(0),
      novelIds.length
        ? this.prisma.chapter.aggregate({
            where: { novelId: { in: novelIds }, updatedAt: { gte: startOfToday() } },
            _sum: { views: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      novelCount: novels.length,
      chapterCount,
      totalWords: novels.reduce((sum, row) => sum + row.words, 0),
      totalViews: novels.reduce((sum, row) => sum + row.views, 0),
      totalFavorites: novels.reduce((sum, row) => sum + row.favorites, 0),
      todayViews: todayViewsAgg?._sum.views ?? 0,
    };
  }
}
