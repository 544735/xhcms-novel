import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BookSource as PrismaBookSource } from '@prisma/client';
import type { BookSource } from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../../common/types';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import type { SourceContext } from './collect.parser';
import { parseBookOutline } from './collect.parser';
import { parseSelectors } from './collect.utils';
import type { CreateBookSourceDto } from './dto/create-book-source.dto';
import type { TestBookSourceDto } from './dto/test-book-source.dto';
import type { UpdateBookSourceDto } from './dto/update-book-source.dto';

/** 数据库中 selectors 为 JSON 字符串，出参统一解析为对象 */
export function toBookSourceDto(row: PrismaBookSource): BookSource {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    type: row.type === 'json' ? 'json' : 'html',
    baseUrl: row.baseUrl,
    listUrl: row.listUrl,
    selectors: parseSelectors(row.selectors),
    enabled: row.enabled,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prisma 书源记录 → 采集解析上下文 */
export function toSourceContext(row: PrismaBookSource): SourceContext {
  return {
    type: row.type === 'json' ? 'json' : 'html',
    baseUrl: row.baseUrl,
    listUrl: row.listUrl,
    selectors: parseSelectors(row.selectors),
  };
}

/** 试采集结果（不落库） */
export interface BookSourceTestResult {
  book: { title: string; author: string; cover: string | null; summary: string | null };
  chapters: { title: string }[];
}

@Injectable()
export class BookSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(siteId: string): Promise<BookSource[]> {
    const rows = await this.prisma.bookSource.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toBookSourceDto);
  }

  async findOne(id: string, siteId: string): Promise<BookSource> {
    const row = await this.requireSource(id, siteId);
    return toBookSourceDto(row);
  }

  async create(
    dto: CreateBookSourceDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<BookSource> {
    const row = await this.prisma.bookSource.create({
      data: {
        siteId,
        name: sanitizePlainText(dto.name, 60),
        type: dto.type ?? 'html',
        baseUrl: dto.baseUrl.trim(),
        listUrl: dto.listUrl?.trim() ? dto.listUrl.trim() : null,
        selectors: dto.selectors ? JSON.stringify(dto.selectors) : null,
        enabled: dto.enabled ?? true,
      },
    });
    await this.audit.log(req, {
      action: 'collect.create',
      resource: 'book-source',
      resourceId: row.id,
      detail: { name: row.name, type: row.type, baseUrl: row.baseUrl },
    });
    return toBookSourceDto(row);
  }

  async update(
    id: string,
    dto: UpdateBookSourceDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<BookSource> {
    const current = await this.requireSource(id, siteId);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      const name = sanitizePlainText(dto.name, 60);
      if (!name) throw new BadRequestException('书源名称不能为空');
      data.name = name;
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl.trim();
    if (dto.listUrl !== undefined) {
      data.listUrl = dto.listUrl?.trim() ? dto.listUrl.trim() : null;
    }
    if (dto.selectors !== undefined) {
      data.selectors = dto.selectors ? JSON.stringify(dto.selectors) : null;
    }
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    const row = await this.prisma.bookSource.update({ where: { id }, data });
    await this.audit.log(req, {
      action: 'collect.update',
      resource: 'book-source',
      resourceId: row.id,
      detail: { name: row.name, enabled: row.enabled, before: current.name },
    });
    return toBookSourceDto(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const current = await this.requireSource(id, siteId);
    await this.prisma.bookSource.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'collect.delete',
      resource: 'book-source',
      resourceId: id,
      detail: { name: current.name, baseUrl: current.baseUrl },
    });
    return null;
  }

  /** 试采集：抓取书籍页并返回书籍信息 + 最多 5 条章节标题，不落库 */
  async test(id: string, dto: TestBookSourceDto, siteId: string): Promise<BookSourceTestResult> {
    const source = await this.requireSource(id, siteId);
    const parsed = await parseBookOutline(toSourceContext(source), dto.bookUrl);
    return {
      book: {
        title: parsed.title,
        author: parsed.author,
        cover: parsed.cover,
        summary: parsed.summary ? parsed.summary : null,
      },
      chapters: parsed.chapters.slice(0, 5).map((chapter) => ({ title: chapter.title })),
    };
  }

  private async requireSource(id: string, siteId: string): Promise<PrismaBookSource> {
    const row = await this.prisma.bookSource.findFirst({ where: { id, siteId } });
    if (!row) throw new NotFoundException('书源不存在');
    return row;
  }
}
