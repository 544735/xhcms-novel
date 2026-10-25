import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from '@wmcms/shared';
import type { Media } from '@wmcms/shared';
import type { Media as PrismaMedia } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthContext, AuthenticatedRequest, FileUpload } from '../../common/types';
import { readImageDimensions } from '../../common/utils/image-size.util';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import { assertSiteAccess } from '../sites/sites.service';
import type { BatchDeleteMediaDto } from './dto/batch-delete-media.dto';
import type { QueryMediaDto } from './dto/query-media.dto';
import type { UploadMediaDto } from './dto/upload-media.dto';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

function toMediaDto(row: PrismaMedia): Media {
  return {
    id: row.id,
    siteId: row.siteId,
    filename: row.filename,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    url: row.url,
    folder: row.folder,
    uploadedById: row.uploadedById,
    createdAt: row.createdAt.toISOString(),
  };
}

function formatYearMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private get uploadRoot(): string {
    const dir = this.config.get<string>('UPLOAD_DIR') ?? 'uploads';
    return resolve(process.cwd(), dir);
  }

  async list(query: QueryMediaDto, siteId: string) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where = {
      siteId,
      ...(query.folder ? { folder: query.folder } : {}),
      ...(query.mimeType
        ? query.mimeType.endsWith('/*')
          ? { mimeType: { startsWith: query.mimeType.slice(0, -1) } }
          : { mimeType: query.mimeType }
        : {}),
      ...(query.keyword?.trim()
        ? { originalName: { contains: query.keyword.trim() } }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.media.count({ where }),
      this.prisma.media.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return paginate(rows.map(toMediaDto), total, page, pageSize);
  }

  async upload(
    file: FileUpload | undefined,
    dto: UploadMediaDto,
    auth: AuthContext,
    req: AuthenticatedRequest,
  ): Promise<Media> {
    // multipart 场景以表单字段 siteId 为准；此处按站点授权做一次显式校验
    assertSiteAccess(auth, dto.siteId);

    const site = await this.prisma.site.findUnique({
      where: { id: dto.siteId },
      select: { id: true },
    });
    if (!site) throw new BadRequestException('站点不存在');

    if (!file) throw new BadRequestException('请选择要上传的文件');
    if (!UPLOAD_ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型：${file.mimetype}`);
    }
    if (!file.size || file.size > UPLOAD_MAX_BYTES) {
      throw new BadRequestException('文件大小不能超过 10MB');
    }

    const originalName = sanitizePlainText(file.originalname, 200) || 'file';
    const ext = this.resolveExtension(originalName, file.mimetype);
    const filename = `${randomUUID()}.${ext}`;
    const folder = dto.folder?.trim() ? sanitizePlainText(dto.folder.trim(), 80) : formatYearMonth();

    const relativePath = `${dto.siteId}/${folder}/${filename}`;
    const absolutePath = resolve(this.uploadRoot, relativePath);
    if (!absolutePath.startsWith(this.uploadRoot)) {
      throw new BadRequestException('非法的文件路径');
    }

    await mkdir(resolve(this.uploadRoot, dto.siteId, folder), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    const isImage = file.mimetype.startsWith('image/');
    const dimensions = isImage ? readImageDimensions(file.buffer) : null;

    const row = await this.prisma.media.create({
      data: {
        siteId: dto.siteId,
        filename,
        originalName,
        mimeType: file.mimetype,
        size: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        url: `/uploads/${relativePath}`,
        folder,
        uploadedById: auth.id,
      },
    });

    await this.audit.log(req, {
      action: 'media.upload',
      resource: 'media',
      resourceId: row.id,
      detail: { originalName: row.originalName, size: row.size, mimeType: row.mimeType },
    });
    return toMediaDto(row);
  }

  async remove(id: string, siteId: string, req: AuthenticatedRequest): Promise<null> {
    const row = await this.prisma.media.findFirst({ where: { id, siteId } });
    if (!row) throw new NotFoundException('媒体不存在');

    await this.prisma.media.delete({ where: { id } });
    await this.removeFile(row.url);
    await this.audit.log(req, {
      action: 'media.delete',
      resource: 'media',
      resourceId: id,
      detail: { originalName: row.originalName },
    });
    return null;
  }

  async batchRemove(
    dto: BatchDeleteMediaDto,
    siteId: string,
    req: AuthenticatedRequest,
  ): Promise<{ affected: number }> {
    const rows = await this.prisma.media.findMany({
      where: { id: { in: dto.ids }, siteId },
      select: { id: true, url: true, originalName: true },
    });
    if (!rows.length) return { affected: 0 };

    const result = await this.prisma.media.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    await Promise.all(rows.map((row) => this.removeFile(row.url)));

    await this.audit.log(req, {
      action: 'media.batch',
      resource: 'media',
      resourceId: null,
      detail: { ids: rows.map((row) => row.id), affected: result.count },
    });
    return { affected: result.count };
  }

  /** 删除磁盘文件（不存在时忽略） */
  private async removeFile(url: string): Promise<void> {
    const relative = url.replace(/^\/?uploads\//, '');
    if (!relative) return;
    const absolutePath = resolve(this.uploadRoot, relative);
    if (!absolutePath.startsWith(this.uploadRoot)) return;
    try {
      await unlink(absolutePath);
    } catch {
      // 文件已不存在：忽略
    }
  }

  private resolveExtension(originalName: string, mimeType: string): string {
    const matched = /\.([a-z0-9]{1,8})$/i.exec(originalName);
    if (matched?.[1]) return matched[1].toLowerCase();
    return EXT_BY_MIME[mimeType] ?? 'bin';
  }
}
