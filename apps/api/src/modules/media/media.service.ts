import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from '@wmcms/shared';
import type { Media } from '@wmcms/shared';
import type { Media as PrismaMedia } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
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

/**
 * 存储扩展名只能由服务端 MIME 决定，绝不能采信客户端文件名
 * （否则 `a.html` + `Content-Type: image/png` 可在 /uploads 下落出同源 HTML）。
 */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/** 允许上传的自定义文件夹名（防止 `..` 穿越到其它站点目录） */
const FOLDER_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

/** magic bytes 校验：声明的 MIME 必须与真实文件头一致 */
const MAGIC_SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (buf) =>
    buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/png': (buf) => buf.length >= 4 && buf.subarray(0, 4).toString('hex') === '89504e47',
  'image/gif': (buf) => {
    if (buf.length < 6) return false;
    const header = buf.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  },
  'image/webp': (buf) =>
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/pdf': (buf) => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-',
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

    // 声明的 MIME 必须与真实文件头一致，避免伪造 Content-Type 绕过白名单
    const matchesMagic = MAGIC_SIGNATURES[file.mimetype];
    if (matchesMagic && !matchesMagic(file.buffer)) {
      throw new BadRequestException('文件内容与声明类型不符');
    }

    // originalName 只用于展示，不参与扩展名与存储路径
    const originalName = sanitizePlainText(file.originalname, 200) || 'file';
    const ext = this.resolveExtension(file.mimetype);
    const filename = `${randomUUID()}.${ext}`;

    const requestedFolder = dto.folder?.trim();
    if (requestedFolder && !FOLDER_PATTERN.test(requestedFolder)) {
      throw new BadRequestException('文件夹名只能包含字母、数字、下划线或连字符');
    }
    const folder = requestedFolder || formatYearMonth();

    const relativePath = `${dto.siteId}/${folder}/${filename}`;
    const absolutePath = resolve(this.uploadRoot, relativePath);
    if (!this.isInsideUploadRoot(absolutePath)) {
      throw new BadRequestException('非法的文件路径');
    }

    await mkdir(resolve(this.uploadRoot, dto.siteId, folder), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    const isImage = file.mimetype.startsWith('image/');
    const dimensions = isImage ? readImageDimensions(file.buffer) : null;

    let row: PrismaMedia;
    try {
      row = await this.prisma.media.create({
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
    } catch (error) {
      // DB 写入失败时回收已落盘的文件，否则会留下批量删除也清不到的孤儿文件
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }

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
    const relativeUrl = url.replace(/^\/?uploads\//, '');
    if (!relativeUrl) return;
    const absolutePath = resolve(this.uploadRoot, relativeUrl);
    if (!this.isInsideUploadRoot(absolutePath)) return;
    try {
      await unlink(absolutePath);
    } catch {
      // 文件已不存在：忽略
    }
  }

  /**
   * 绝对路径是否位于上传根目录内。
   * 用 relative 语义判断，避免 `startsWith('/app/uploads')` 被 `/app/uploads-evil` 绕过，
   * 也避免 `folder=../other-site` 之类穿越。
   */
  private isInsideUploadRoot(absolutePath: string): boolean {
    const rel = relative(this.uploadRoot, absolutePath);
    return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
  }

  /** 扩展名只由服务端 MIME 决定（见 EXT_BY_MIME），不采信客户端文件名 */
  private resolveExtension(mimeType: string): string {
    return EXT_BY_MIME[mimeType] ?? 'bin';
  }
}
