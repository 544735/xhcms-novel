import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import iconv from 'iconv-lite';
import { TextDecoder } from 'node:util';
import type {
  ChapterContent,
  ChapterStatus,
  ChapterSummary,
  Paginated,
  TxtImportResult,
} from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest, FileUpload } from '../../common/types';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import { SitesService } from '../sites/sites.service';
import type { CreateChapterDto } from './dto/create-chapter.dto';
import type { ImportTxtDto } from './dto/import-txt.dto';
import type { QueryChapterDto } from './dto/query-chapter.dto';
import type { UpdateChapterDto } from './dto/update-chapter.dto';
import {
  chapterRefSelect,
  chapterSummarySelect,
  toChapterSummary,
  toLatestChapterRef,
} from './novel.mapper';
import {
  compileChapterPattern,
  countChapterWords,
  estimateReadingTime,
  normalizeChapterPrice,
  splitTxtChapters,
  toPlainChapterContent,
} from './novel.util';

/** 管理端章节详情（含完整正文） */
export interface AdminChapterDetail extends ChapterSummary {
  content: string;
}

interface NovelBrief {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  authorId: string | null;
  vipOnly: boolean;
  chapterCount: number;
}

/** 上传 TXT 编码识别：BOM → UTF-8；严格 UTF-8 解码失败回落到 GBK */
function decodeTxtBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return iconv.decode(buffer, 'gbk');
  }
}

function toAdminChapterDetail(row: {
  id: string;
  novelId: string;
  volumeId: string | null;
  chapterNo: number;
  title: string;
  content: string;
  wordCount: number;
  isVip: boolean;
  price: number;
  status: string;
  views: number;
  publishedAt: Date | null;
  updatedAt: Date;
}): AdminChapterDetail {
  return {
    id: row.id,
    novelId: row.novelId,
    volumeId: row.volumeId,
    chapterNo: row.chapterNo,
    title: row.title,
    content: row.content,
    wordCount: row.wordCount,
    isVip: row.isVip,
    price: row.price,
    status: row.status as ChapterStatus,
    views: row.views,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ChaptersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
    private readonly sites: SitesService,
  ) {}

  /* ------------------------------- 管理端 ------------------------------- */

  async list(query: QueryChapterDto, siteId: string): Promise<Paginated<ChapterSummary>> {
    await this.findNovelOrThrow(query.novelId, siteId);
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.ChapterWhereInput = { novelId: query.novelId };
    if (query.status) where.status = query.status;
    if (query.volumeId) where.volumeId = query.volumeId;
    const keyword = query.keyword?.trim();
    if (keyword) {
      where.title = { contains: keyword };
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.chapter.count({ where }),
      this.prisma.chapter.findMany({
        where,
        skip,
        take,
        orderBy: { chapterNo: 'asc' },
        select: chapterSummarySelect,
      }),
    ]);
    return paginate(rows.map(toChapterSummary), total, page, pageSize);
  }

  async findOne(id: string, siteId: string): Promise<AdminChapterDetail> {
    const { chapter } = await this.findChapterOrThrow(id, siteId);
    return toAdminChapterDetail(chapter);
  }

  async create(
    dto: CreateChapterDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    const novel = await this.findNovelOrThrow(dto.novelId, siteId);
    const volumeId = await this.resolveVolumeId(dto.volumeId, novel.id);
    const content = toPlainChapterContent(dto.content);
    const isVip = dto.isVip ?? false;
    const status: ChapterStatus = dto.status ?? 'published';
    const chapterNo = await this.nextChapterNo(novel.id);

    const row = await this.prisma.chapter.create({
      data: {
        novelId: novel.id,
        volumeId,
        chapterNo,
        title: sanitizePlainText(dto.title, 200) || '未命名章节',
        content,
        wordCount: countChapterWords(content),
        isVip,
        price: normalizeChapterPrice(isVip, dto.price),
        status,
        publishedAt: status === 'published' ? new Date() : null,
      },
    });

    await this.recalculateNovel(novel.id);
    await this.audit.log(req, {
      action: 'chapter.create',
      resource: 'chapter',
      resourceId: row.id,
      detail: { novelId: novel.id, chapterNo: row.chapterNo, title: row.title, isVip },
    });
    if (status === 'published') {
      await this.pluginHost.runHook('chapter.afterPublish', {
        chapterId: row.id,
        novelId: novel.id,
        siteId,
      });
    }
    return toAdminChapterDetail(row);
  }

  async update(
    id: string,
    dto: UpdateChapterDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    const { chapter } = await this.findChapterOrThrow(id, siteId);
    if (dto.novelId !== undefined && dto.novelId !== chapter.novelId) {
      throw new BadRequestException('不支持将章节移动到其他书籍');
    }
    const data: Prisma.ChapterUncheckedUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = sanitizePlainText(dto.title, 200) || '未命名章节';
    }
    if (dto.content !== undefined) {
      const content = toPlainChapterContent(dto.content);
      data.content = content;
      data.wordCount = countChapterWords(content);
    }
    if (dto.volumeId !== undefined) {
      data.volumeId = await this.resolveVolumeId(dto.volumeId, chapter.novelId);
    }
    if (dto.isVip !== undefined || dto.price !== undefined) {
      const isVip = dto.isVip ?? chapter.isVip;
      data.isVip = isVip;
      data.price = normalizeChapterPrice(
        isVip,
        dto.price !== undefined ? dto.price : chapter.price,
      );
    }
    if (dto.status !== undefined && dto.status !== chapter.status) {
      data.status = dto.status;
      if (dto.status === 'published' && !chapter.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    if (dto.chapterNo !== undefined && dto.chapterNo !== chapter.chapterNo) {
      const duplicate = await this.prisma.chapter.findUnique({
        where: { novelId_chapterNo: { novelId: chapter.novelId, chapterNo: dto.chapterNo } },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== chapter.id) {
        throw new ConflictException(`章节序号 ${dto.chapterNo} 已存在，请更换`);
      }
      data.chapterNo = dto.chapterNo;
    }

    const row = await this.prisma.chapter.update({ where: { id }, data });
    await this.recalculateNovel(chapter.novelId);
    await this.audit.log(req, {
      action: 'chapter.update',
      resource: 'chapter',
      resourceId: row.id,
      detail: { novelId: chapter.novelId, chapterNo: row.chapterNo, title: row.title },
    });
    if (row.status === 'published' && chapter.status !== 'published') {
      await this.pluginHost.runHook('chapter.afterPublish', {
        chapterId: row.id,
        novelId: chapter.novelId,
        siteId,
      });
    }
    return toAdminChapterDetail(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const { chapter } = await this.findChapterOrThrow(id, siteId);
    await this.prisma.chapter.delete({ where: { id } });
    await this.recalculateNovel(chapter.novelId);
    await this.audit.log(req, {
      action: 'chapter.delete',
      resource: 'chapter',
      resourceId: id,
      detail: { novelId: chapter.novelId, chapterNo: chapter.chapterNo, title: chapter.title },
    });
    return null;
  }

  async publish(id: string, siteId: string, req: AuthenticatedRequest): Promise<AdminChapterDetail> {
    const { chapter } = await this.findChapterOrThrow(id, siteId);
    const row = await this.prisma.chapter.update({
      where: { id },
      data: { status: 'published', publishedAt: chapter.publishedAt ?? new Date() },
    });
    await this.recalculateNovel(chapter.novelId);
    await this.audit.log(req, {
      action: 'chapter.publish',
      resource: 'chapter',
      resourceId: row.id,
      detail: { novelId: chapter.novelId, chapterNo: row.chapterNo, title: row.title },
    });
    await this.pluginHost.runHook('chapter.afterPublish', {
      chapterId: row.id,
      novelId: chapter.novelId,
      siteId,
    });
    return toAdminChapterDetail(row);
  }

  async unpublish(
    id: string,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    const { chapter } = await this.findChapterOrThrow(id, siteId);
    const row = await this.prisma.chapter.update({
      where: { id },
      data: { status: 'draft' },
    });
    await this.recalculateNovel(chapter.novelId);
    await this.audit.log(req, {
      action: 'chapter.unpublish',
      resource: 'chapter',
      resourceId: row.id,
      detail: { novelId: chapter.novelId, chapterNo: row.chapterNo, title: row.title },
    });
    return toAdminChapterDetail(row);
  }

  /** TXT 导入：自动识别 UTF-8/GBK，按正则分章，正文转纯文本后批量入库 */
  async importTxt(
    novelId: string,
    file: FileUpload | undefined,
    dto: ImportTxtDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<TxtImportResult> {
    const novel = await this.findNovelOrThrow(novelId, siteId);
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请上传 TXT 文件（multipart 字段名 file）');
    }

    const text = decodeTxtBuffer(file.buffer);
    if (!text.trim()) throw new BadRequestException('TXT 内容为空，无法导入');

    let pattern: RegExp;
    try {
      pattern = compileChapterPattern(dto.pattern);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const parsed = splitTxtChapters(text, pattern);
    if (!parsed.length) {
      throw new BadRequestException('未从 TXT 中解析出章节内容，请检查分章正则');
    }

    let volumeId: string | null = null;
    const volumeTitle = dto.volumeTitle?.trim();
    if (volumeTitle) {
      const lastVolume = await this.prisma.volume.findFirst({
        where: { novelId: novel.id },
        orderBy: { sort: 'desc' },
        select: { sort: true },
      });
      const volume = await this.prisma.volume.create({
        data: {
          novelId: novel.id,
          title: sanitizePlainText(volumeTitle, 100) || '正文',
          sort: (lastVolume?.sort ?? -1) + 1,
        },
      });
      volumeId = volume.id;
    }

    const startNo = await this.nextChapterNo(novel.id);
    const now = new Date();
    const data = parsed.map((item, index) => ({
      novelId: novel.id,
      volumeId,
      chapterNo: startNo + index,
      title: item.title,
      content: item.content,
      wordCount: countChapterWords(item.content),
      isVip: false,
      price: 0,
      status: 'published',
      publishedAt: now,
    }));

    await this.prisma.chapter.createMany({ data });
    await this.recalculateNovel(novel.id);

    const words = data.reduce((sum, item) => sum + item.wordCount, 0);
    await this.audit.log(req, {
      action: 'chapter.import',
      resource: 'chapter',
      resourceId: novel.id,
      detail: { novelId: novel.id, chapters: data.length, words, volumeId },
    });
    return { novelId: novel.id, chapters: data.length, words };
  }

  /* -------------------------------- 门户 -------------------------------- */

  /**
   * 门户章节阅读：
   * - 仅 published 章节可见；
   * - VIP 章节（chapter.isVip 或 novel.vipOnly 且有价格）未解锁时 locked=true、content=""、preview 由插件生成；
   * - 已解锁（购买记录 / 本书作者）返回完整正文与钱包余额；
   * - 阅读写 ReadingProgress，chapter.views / novel.views +1。
   */
  async publicChapter(
    siteSlug: string,
    novelSlug: string,
    chapterNoRaw: string,
    memberId: string | undefined,
    percentInput: number | undefined,
  ): Promise<ChapterContent> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    const chapterNo = Number(chapterNoRaw);
    if (!Number.isInteger(chapterNo) || chapterNo < 1) {
      throw new NotFoundException('章节不存在');
    }

    const novel = await this.prisma.novel.findFirst({
      where: { siteId: site.id, slug: novelSlug, auditStatus: 'published' },
      select: {
        id: true,
        siteId: true,
        title: true,
        slug: true,
        authorId: true,
        vipOnly: true,
        chapterCount: true,
      },
    });
    if (!novel) throw new NotFoundException('书籍不存在或已下架');

    const chapter = await this.prisma.chapter.findFirst({
      where: { novelId: novel.id, chapterNo, status: 'published' },
    });
    if (!chapter) throw new NotFoundException('章节不存在');

    const needsPayment = chapter.price > 0 && (chapter.isVip || novel.vipOnly);
    let unlocked = !needsPayment;
    if (needsPayment && memberId) {
      if (novel.authorId && novel.authorId === memberId) {
        unlocked = true;
      } else {
        const record = await this.prisma.chapterUnlock.findUnique({
          where: { memberId_chapterId: { memberId, chapterId: chapter.id } },
          select: { id: true },
        });
        unlocked = record !== null;
      }
    }
    const locked = needsPayment && !unlocked;

    // 插件钩子：生成试读比例（vip-guard）与阅读时长/字数（chapter-stats）
    const hookResult = await this.pluginHost.runHook('chapter.beforeRender', {
      chapterId: chapter.id,
      chapterNo: chapter.chapterNo,
      novelId: novel.id,
      siteId: site.id,
      title: chapter.title,
      content: chapter.content,
      isVip: chapter.isVip,
      unlocked,
    });
    const preview =
      locked && typeof hookResult.preview === 'string' ? hookResult.preview : null;
    const wordCount =
      typeof hookResult.wordCount === 'number' ? hookResult.wordCount : chapter.wordCount;
    const readingTime =
      typeof hookResult.readingTime === 'number' && hookResult.readingTime > 0
        ? hookResult.readingTime
        : estimateReadingTime(chapter.content);

    // 浏览量自增（章节 + 书籍）
    await this.prisma.$transaction([
      this.prisma.chapter.update({
        where: { id: chapter.id },
        data: { views: { increment: 1 } },
      }),
      this.prisma.novel.update({
        where: { id: novel.id },
        data: { views: { increment: 1 } },
      }),
    ]);

    let balance: number | null = null;
    if (memberId) {
      const totalChapters = novel.chapterCount > 0 ? novel.chapterCount : 1;
      const fallbackPercent = Math.max(
        0,
        Math.min(100, Math.round((chapter.chapterNo / totalChapters) * 100)),
      );
      const percent =
        typeof percentInput === 'number' && Number.isFinite(percentInput)
          ? Math.max(0, Math.min(100, percentInput))
          : fallbackPercent;
      await this.prisma.readingProgress.upsert({
        where: { memberId_novelId: { memberId, novelId: novel.id } },
        create: {
          memberId,
          novelId: novel.id,
          chapterId: chapter.id,
          chapterNo: chapter.chapterNo,
          percent,
        },
        update: { chapterId: chapter.id, chapterNo: chapter.chapterNo, percent },
      });
      if (!locked) {
        const wallet = await this.prisma.wallet.findUnique({
          where: { memberId },
          select: { balance: true },
        });
        balance = wallet?.balance ?? 0;
      }
    }

    const prevRow = await this.prisma.chapter.findFirst({
      where: { novelId: novel.id, status: 'published', chapterNo: { lt: chapter.chapterNo } },
      orderBy: { chapterNo: 'desc' },
      select: chapterRefSelect,
    });
    const nextRow = await this.prisma.chapter.findFirst({
      where: { novelId: novel.id, status: 'published', chapterNo: { gt: chapter.chapterNo } },
      orderBy: { chapterNo: 'asc' },
      select: chapterRefSelect,
    });

    return {
      id: chapter.id,
      novelId: novel.id,
      novelSlug: novel.slug,
      novelTitle: novel.title,
      volumeId: chapter.volumeId,
      chapterNo: chapter.chapterNo,
      title: chapter.title,
      content: locked ? '' : chapter.content,
      wordCount,
      isVip: chapter.isVip,
      price: chapter.price,
      locked,
      unlocked: !locked,
      preview,
      balance,
      prevChapter: toLatestChapterRef(prevRow),
      nextChapter: toLatestChapterRef(nextRow),
      readingTime,
      views: chapter.views + 1,
      publishedAt: chapter.publishedAt ? chapter.publishedAt.toISOString() : null,
    };
  }

  /* ------------------------------- 内部工具 ------------------------------- */

  /** 重算书籍的字数/章节数/最后更新时间（仅统计已发布章节） */
  async recalculateNovel(novelId: string): Promise<void> {
    const rows = await this.prisma.chapter.findMany({
      where: { novelId, status: 'published' },
      select: { wordCount: true, publishedAt: true },
    });
    const words = rows.reduce((sum, row) => sum + row.wordCount, 0);
    let lastChapterAt: Date | null = null;
    for (const row of rows) {
      if (!row.publishedAt) continue;
      if (!lastChapterAt || row.publishedAt.getTime() > lastChapterAt.getTime()) {
        lastChapterAt = row.publishedAt;
      }
    }
    await this.prisma.novel.update({
      where: { id: novelId },
      data: { words, chapterCount: rows.length, lastChapterAt },
    });
  }

  private async nextChapterNo(novelId: string): Promise<number> {
    const last = await this.prisma.chapter.findFirst({
      where: { novelId },
      orderBy: { chapterNo: 'desc' },
      select: { chapterNo: true },
    });
    return (last?.chapterNo ?? 0) + 1;
  }

  private async findNovelOrThrow(novelId: string, siteId: string): Promise<NovelBrief> {
    const novel = await this.prisma.novel.findFirst({
      where: { id: novelId, siteId },
      select: {
        id: true,
        siteId: true,
        title: true,
        slug: true,
        authorId: true,
        vipOnly: true,
        chapterCount: true,
      },
    });
    if (!novel) throw new NotFoundException('书籍不存在或不属于当前站点');
    return novel;
  }

  private async findChapterOrThrow(id: string, siteId: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id } });
    if (!chapter) throw new NotFoundException('章节不存在');
    const novel = await this.prisma.novel.findFirst({
      where: { id: chapter.novelId, siteId },
      select: { id: true, siteId: true, title: true, slug: true, authorId: true },
    });
    if (!novel) throw new NotFoundException('章节不存在');
    return { chapter, novel };
  }

  private async resolveVolumeId(
    volumeId: string | null | undefined,
    novelId: string,
  ): Promise<string | null> {
    if (!volumeId) return null;
    const volume = await this.prisma.volume.findFirst({
      where: { id: volumeId, novelId },
      select: { id: true },
    });
    if (!volume) throw new BadRequestException('分卷不存在或不属于当前书籍');
    return volume.id;
  }
}
