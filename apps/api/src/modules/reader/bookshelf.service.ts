import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BookshelfItem,
  PageQuery,
  Paginated,
  ReadingHistoryItem,
} from '@wmcms/shared';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AddBookshelfDto, HistoryQueryDto, SaveProgressDto } from './dto/reader.dto';
import {
  novelRefsInclude,
  normalizePercent,
  requireActiveMember,
  resolveActiveSite,
  toLatestChapterRef,
  toNovelCard,
} from './reader.util';

/**
 * 书架 / 阅读历史 / 阅读进度（会员接口）。
 * 会员 token 由 MemberAuthGuard 校验，此处再校验会员属于当前站点且状态正常。
 */
@Injectable()
export class BookshelfService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /public/sites/:slug/members/bookshelf */
  async list(siteSlug: string, memberId: string): Promise<BookshelfItem[]> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const rows = await this.prisma.bookshelf.findMany({
      where: { memberId, novel: { siteId: site.id } },
      orderBy: { createdAt: 'desc' },
      include: { novel: { include: novelRefsInclude } },
    });

    const novelIds = rows.map((row) => row.novelId);
    const progresses = novelIds.length
      ? await this.prisma.readingProgress.findMany({
          where: { memberId, novelId: { in: novelIds } },
        })
      : [];
    const progressByNovel = new Map(progresses.map((row) => [row.novelId, row]));

    return rows.map((row) => {
      const progress = progressByNovel.get(row.novelId);
      return {
        novel: toNovelCard(row.novel),
        addedAt: row.createdAt.toISOString(),
        lastChapter: row.novel.chapters.length ? toLatestChapterRef(row.novel.chapters[0]) : null,
        progress: progress
          ? {
              chapterId: progress.chapterId,
              chapterNo: progress.chapterNo,
              percent: progress.percent,
              updatedAt: progress.updatedAt.toISOString(),
            }
          : null,
      };
    });
  }

  /** POST /public/sites/:slug/members/bookshelf（幂等） */
  async add(
    siteSlug: string,
    memberId: string,
    dto: AddBookshelfDto,
  ): Promise<{ added: true }> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const novel = await this.prisma.novel.findFirst({
      where: { id: dto.novelId, siteId: site.id, auditStatus: 'published' },
      select: { id: true },
    });
    if (!novel) throw new NotFoundException('书籍不存在或未上架');

    await this.prisma.bookshelf.upsert({
      where: { memberId_novelId: { memberId, novelId: novel.id } },
      create: { memberId, novelId: novel.id },
      update: {},
    });
    return { added: true };
  }

  /** DELETE /public/sites/:slug/members/bookshelf/:novelId（幂等） */
  async remove(siteSlug: string, memberId: string, novelId: string): Promise<null> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    await this.prisma.bookshelf.deleteMany({
      where: { memberId, novelId, novel: { siteId: site.id } },
    });
    return null;
  }

  /** GET /public/sites/:slug/members/history */
  async history(
    siteSlug: string,
    memberId: string,
    query: HistoryQueryDto,
  ): Promise<Paginated<ReadingHistoryItem>> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const where = { memberId, novel: { siteId: site.id } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.readingProgress.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: { novel: { include: novelRefsInclude } },
      }),
      this.prisma.readingProgress.count({ where }),
    ]);

    const chapterIds = rows.map((row) => row.chapterId);
    const chapters = chapterIds.length
      ? await this.prisma.chapter.findMany({
          where: { id: { in: chapterIds } },
          select: { id: true, title: true },
        })
      : [];
    const titleByChapter = new Map(chapters.map((row) => [row.id, row.title]));

    const items: ReadingHistoryItem[] = rows.map((row) => ({
      novel: toNovelCard(row.novel),
      chapterId: row.chapterId,
      chapterNo: row.chapterNo,
      chapterTitle: titleByChapter.get(row.chapterId) ?? '',
      percent: row.percent,
      updatedAt: row.updatedAt.toISOString(),
    }));

    return paginate(items, total, page, pageSize);
  }

  /** PUT /public/sites/:slug/members/progress（按 memberId+novelId upsert） */
  async saveProgress(
    siteSlug: string,
    memberId: string,
    dto: SaveProgressDto,
  ): Promise<null> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const chapter = await this.prisma.chapter.findFirst({
      where: { id: dto.chapterId, novelId: dto.novelId, novel: { siteId: site.id } },
      select: { id: true, chapterNo: true },
    });
    if (!chapter) throw new NotFoundException('章节不存在');

    const percent = normalizePercent(dto.percent);
    await this.prisma.readingProgress.upsert({
      where: { memberId_novelId: { memberId, novelId: dto.novelId } },
      create: {
        memberId,
        novelId: dto.novelId,
        chapterId: chapter.id,
        chapterNo: chapter.chapterNo,
        percent,
      },
      update: { chapterId: chapter.id, chapterNo: chapter.chapterNo, percent },
    });
    return null;
  }
}
