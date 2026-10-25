import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BookSource as PrismaBookSource } from '@prisma/client';
import type { CollectTask, CollectTaskStatus, Paginated } from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import { toSourceContext } from './book-sources.service';
import { parseBookOutline, parseChapterContent, type ParsedBook } from './collect.parser';
import { sleep } from './collect.utils';
import type { QueryCollectTaskDto } from './dto/query-collect-task.dto';
import type { RunCollectDto } from './dto/run-collect.dto';

/** 每章抓取间隔（毫秒），契约要求 ≥300ms */
const CHAPTER_DELAY_MS = 300;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const collectTaskInclude = {
  source: { select: { name: true } },
  novel: { select: { title: true } },
} satisfies Prisma.CollectTaskInclude;

type TaskRow = Prisma.CollectTaskGetPayload<{ include: typeof collectTaskInclude }>;

export function toCollectTaskDto(row: TaskRow): CollectTask {
  return {
    id: row.id,
    siteId: row.siteId,
    sourceId: row.sourceId,
    novelId: row.novelId,
    mode: row.mode === 'book' ? 'book' : 'chapters',
    status: row.status as CollectTaskStatus,
    total: row.total,
    succeeded: row.succeeded,
    failed: row.failed,
    message: row.message,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    sourceName: row.source?.name ?? null,
    novelTitle: row.novel?.title ?? null,
  };
}

interface RunOutcome {
  status: CollectTaskStatus;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  message: string | null;
  novelId: string | null;
}

@Injectable()
export class CollectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 正式采集：创建任务 → 抓取解析 → 建书/追章 → 重算书籍统计 → 写审计 */
  async run(dto: RunCollectDto, siteId: string, req: AuthenticatedRequest): Promise<CollectTask> {
    const source = await this.prisma.bookSource.findFirst({
      where: { id: dto.sourceId, siteId },
    });
    if (!source) throw new NotFoundException('书源不存在');
    if (!source.enabled) throw new BadRequestException('书源已停用，无法采集');

    let novelId = dto.novelId?.trim() ? dto.novelId.trim() : null;
    if (novelId) {
      const novel = await this.prisma.novel.findFirst({
        where: { id: novelId, siteId },
        select: { id: true },
      });
      if (!novel) throw new NotFoundException('目标书籍不存在');
    }

    const limit = this.resolveLimit(dto.limit);
    const task = await this.prisma.collectTask.create({
      data: {
        siteId,
        sourceId: source.id,
        novelId,
        mode: novelId ? 'chapters' : 'book',
        status: 'running',
        startedAt: new Date(),
      },
    });

    let outcome: RunOutcome;
    try {
      outcome = await this.executeRun(source, siteId, dto, limit, novelId);
    } catch (error) {
      outcome = {
        status: 'failed',
        total: 0,
        succeeded: 0,
        failed: 1,
        skipped: 0,
        message: ((error as Error).message || '采集失败').slice(0, 500),
        novelId,
      };
    }

    await this.prisma.collectTask.update({
      where: { id: task.id },
      data: {
        novelId: outcome.novelId,
        mode: novelId ? 'chapters' : 'book',
        status: outcome.status,
        total: outcome.total,
        succeeded: outcome.succeeded,
        failed: outcome.failed,
        message: outcome.message,
        finishedAt: new Date(),
      },
    });
    await this.prisma.bookSource.update({
      where: { id: source.id },
      data: { lastRunAt: new Date() },
    });
    if (outcome.novelId) await this.recomputeNovel(outcome.novelId);

    const finished = await this.prisma.collectTask.findUniqueOrThrow({
      where: { id: task.id },
      include: collectTaskInclude,
    });

    await this.audit.log(req, {
      action: 'collect.run',
      resource: 'collect',
      resourceId: task.id,
      detail: {
        sourceId: source.id,
        sourceName: source.name,
        mode: finished.mode,
        status: outcome.status,
        total: outcome.total,
        succeeded: outcome.succeeded,
        failed: outcome.failed,
        novelId: outcome.novelId,
      },
    });

    return toCollectTaskDto(finished);
  }

  async listTasks(query: QueryCollectTaskDto, siteId: string): Promise<Paginated<CollectTask>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.CollectTaskWhereInput = {
      siteId,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.collectTask.count({ where }),
      this.prisma.collectTask.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: collectTaskInclude,
      }),
    ]);
    return paginate(rows.map(toCollectTaskDto), total, page, pageSize);
  }

  async findTask(id: string, siteId: string): Promise<CollectTask> {
    const row = await this.prisma.collectTask.findFirst({
      where: { id, siteId },
      include: collectTaskInclude,
    });
    if (!row) throw new NotFoundException('采集任务不存在');
    return toCollectTaskDto(row);
  }

  /* ------------------------------- 内部实现 ------------------------------- */

  private async executeRun(
    source: PrismaBookSource,
    siteId: string,
    dto: RunCollectDto,
    limit: number,
    initialNovelId: string | null,
  ): Promise<RunOutcome> {
    const ctx = toSourceContext(source);
    const parsed = await parseBookOutline(ctx, dto.bookUrl);
    const outline = parsed.chapters.slice(0, limit);
    const total = outline.length;

    let novelId = initialNovelId;
    if (!novelId) novelId = await this.findOrCreateNovel(siteId, parsed);
    if (!novelId) throw new BadRequestException('无法确定目标书籍');

    if (total === 0) {
      return {
        status: 'failed',
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        message: '未解析到章节列表，请检查选择器配置',
        novelId,
      };
    }

    const existing = await this.prisma.chapter.findMany({
      where: { novelId },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((row) => row.title));
    const maxRow = await this.prisma.chapter.aggregate({
      where: { novelId },
      _max: { chapterNo: true },
    });
    let nextNo = (maxRow._max.chapterNo ?? 0) + 1;

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const messages: string[] = [];

    for (const chapter of outline) {
      if (existingTitles.has(chapter.title)) {
        skipped += 1;
        continue;
      }
      try {
        // 限速：每章抓取前等待 ≥300ms（JSON 正文随列表返回，无需额外请求）
        if (source.type !== 'json') await sleep(CHAPTER_DELAY_MS);
        const parsedChapter = await parseChapterContent(ctx, chapter);
        if (existingTitles.has(parsedChapter.title)) {
          skipped += 1;
          continue;
        }
        await this.prisma.chapter.create({
          data: {
            novelId,
            chapterNo: nextNo,
            title: parsedChapter.title,
            content: parsedChapter.content,
            wordCount: parsedChapter.wordCount,
            status: 'published',
            publishedAt: new Date(),
          },
        });
        existingTitles.add(parsedChapter.title);
        nextNo += 1;
        succeeded += 1;
      } catch (error) {
        failed += 1;
        if (messages.length < 5) {
          messages.push(`《${chapter.title}》${(error as Error).message}`);
        }
      }
    }

    const status: CollectTaskStatus =
      failed === 0 ? 'success' : succeeded > 0 ? 'partial' : 'failed';
    if (succeeded > 0) messages.unshift(`成功采集 ${succeeded} 章`);
    if (skipped > 0) messages.push(`跳过已存在章节 ${skipped} 章`);

    return {
      status,
      total,
      succeeded,
      failed,
      skipped,
      message: messages.length ? messages.join('；').slice(0, 500) : null,
      novelId,
    };
  }

  /** 同站点内按「书名 + 作者」去重，不存在则新建（auditStatus=published，分类可空） */
  private async findOrCreateNovel(siteId: string, parsed: ParsedBook): Promise<string> {
    const title = parsed.title || '未命名书籍';
    const authorName = parsed.author || '采集';

    const existing = await this.prisma.novel.findFirst({
      where: { siteId, title, authorName },
      select: { id: true },
    });
    if (existing) return existing.id;

    const slug = await ensureUniqueSlug(slugify(title), async (candidate) => {
      const row = await this.prisma.novel.findUnique({
        where: { siteId_slug: { siteId, slug: candidate } },
        select: { id: true },
      });
      return row !== null;
    });

    const novel = await this.prisma.novel.create({
      data: {
        siteId,
        title,
        slug,
        authorName,
        cover: parsed.cover,
        summary: parsed.summary ? parsed.summary.slice(0, 500) : null,
        status: 'serial',
        auditStatus: 'published',
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    return novel.id;
  }

  /** 重算书籍字数 / 章节数 / 最新章节时间（publishedAt 缺失时补写） */
  private async recomputeNovel(novelId: string): Promise<void> {
    const [chapters, novel] = await Promise.all([
      this.prisma.chapter.findMany({
        where: { novelId },
        select: { wordCount: true, publishedAt: true, createdAt: true },
      }),
      this.prisma.novel.findUnique({
        where: { id: novelId },
        select: { id: true, publishedAt: true },
      }),
    ]);
    if (!novel) return;

    const words = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
    const lastChapterAt = chapters.reduce<Date | null>((latest, chapter) => {
      const at = chapter.publishedAt ?? chapter.createdAt;
      return !latest || at > latest ? at : latest;
    }, null);

    await this.prisma.novel.update({
      where: { id: novelId },
      data: {
        words,
        chapterCount: chapters.length,
        lastChapterAt,
        ...(novel.publishedAt ? {} : { publishedAt: new Date() }),
      },
    });
  }

  private resolveLimit(limit: number | undefined): number {
    if (limit === undefined || limit === null || !Number.isFinite(Number(limit))) {
      return DEFAULT_LIMIT;
    }
    return Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit))));
  }
}
