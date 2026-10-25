import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CommentStatus,
  NovelComment,
  PageQuery,
  Paginated,
  PublicNovelComment,
} from '@wmcms/shared';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { clientIp } from '../../common/utils/request.util';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import type { AuthenticatedRequest } from '../../common/types';
import {
  CreateNovelCommentDto,
  PublicNovelCommentQueryDto,
  QueryNovelCommentDto,
} from './dto/novel-comment.dto';
import {
  requireActiveMember,
  resolveActiveSite,
  resolveCommentAudit,
  resolveOptionalMember,
} from './reader.util';

/** 评论正文上限（与插件校验保持一致） */
const CONTENT_MAX_LENGTH = 2000;

type NovelCommentRow = Prisma.NovelCommentGetPayload<{
  include: {
    novel: { select: { id: true; title: true; slug: true } };
    chapter: { select: { id: true; title: true; chapterNo: true } };
  };
}>;

/** 管理端书评/章评条目（含所属书籍/章节标题） */
export interface AdminNovelComment extends NovelComment {
  novel?: { id: string; title: string; slug: string } | null;
  chapter?: { id: string; title: string; chapterNo: number } | null;
}

function toAdminComment(row: NovelCommentRow): AdminNovelComment {
  return {
    id: row.id,
    siteId: row.siteId,
    novelId: row.novelId,
    chapterId: row.chapterId,
    memberId: row.memberId,
    parentId: row.parentId,
    nickname: row.nickname,
    content: row.content,
    status: row.status as CommentStatus,
    createdAt: row.createdAt.toISOString(),
    chapterTitle: row.chapter?.title ?? null,
    novel: row.novel ? { id: row.novel.id, title: row.novel.title, slug: row.novel.slug } : null,
    chapter: row.chapter
      ? { id: row.chapter.id, title: row.chapter.title, chapterNo: row.chapter.chapterNo }
      : null,
  };
}

/** 扁平评论 → 树（孤儿节点提升为根，避免审核状态导致回复丢失） */
function buildTree(rows: PublicNovelComment[]): PublicNovelComment[] {
  const map = new Map<string, PublicNovelComment>();
  for (const row of rows) map.set(row.id, { ...row, children: [] });

  const roots: PublicNovelComment[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    const parent = row.parentId ? map.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

@Injectable()
export class NovelCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
  ) {}

  /* ---------------------------- 门户 ---------------------------- */

  /** GET /public/sites/:slug/novel-comments：仅已审核评论，根评论分页、回复随根返回 */
  async publicTree(
    siteSlug: string,
    query: PublicNovelCommentQueryDto,
  ): Promise<PublicNovelComment[]> {
    const site = await resolveActiveSite(this.prisma, siteSlug);

    const novel = await this.prisma.novel.findFirst({
      where: { id: query.novelId, siteId: site.id },
      select: { id: true },
    });
    if (!novel) throw new NotFoundException('书籍不存在');

    const rows = await this.prisma.novelComment.findMany({
      where: {
        siteId: site.id,
        novelId: novel.id,
        status: 'approved',
        ...(query.chapterId ? { chapterId: query.chapterId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { member: { select: { avatar: true } } },
    });

    const tree = buildTree(
      rows.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        nickname: row.nickname,
        avatar: row.member?.avatar ?? null,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        children: [],
      })),
    );

    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 20)));
    const skip = (page - 1) * pageSize;
    return tree.slice(skip, skip + pageSize);
  }

  /** POST /public/sites/:slug/novel-comments：匿名或会员提交，按站点设置决定是否审核 */
  async createPublic(
    siteSlug: string,
    dto: CreateNovelCommentDto,
    req: AuthenticatedRequest,
  ): Promise<{ id: string; status: string }> {
    const site = await resolveActiveSite(this.prisma, siteSlug);

    const novel = await this.prisma.novel.findFirst({
      where: { id: dto.novelId, siteId: site.id },
      select: { id: true, title: true },
    });
    if (!novel) throw new NotFoundException('书籍不存在');

    // 章节校验（可选）：必须属于当前书籍
    let chapterId: string | null = null;
    if (dto.chapterId) {
      const chapter = await this.prisma.chapter.findFirst({
        where: { id: dto.chapterId, novelId: novel.id },
        select: { id: true, title: true },
      });
      if (!chapter) throw new BadRequestException('章节不存在');
      chapterId = chapter.id;
    }

    // 父评论校验（回复）：继承父评论章节，且必须属于同一本书
    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.novelComment.findFirst({
        where: { id: dto.parentId, siteId: site.id, novelId: novel.id },
        select: { id: true, chapterId: true },
      });
      if (!parent) throw new BadRequestException('回复的评论不存在');
      if (parent.chapterId) {
        if (chapterId && chapterId !== parent.chapterId) {
          throw new BadRequestException('回复的评论不属于当前章节');
        }
        chapterId = parent.chapterId;
      }
      parentId = parent.id;
    }

    // 会员身份（可选登录）：仅接受与当前站点一致且状态正常的会员
    const member = await resolveOptionalMember(this.prisma, site.id, req.member?.id ?? null);
    const nickname = member
      ? member.nickname || member.username
      : sanitizePlainText(dto.nickname, 30) || '匿名读者';

    // 正文清洗（先清洗再交给插件，避免 HTML 标签绕过敏感词检测）
    const content = sanitizePlainText(dto.content, CONTENT_MAX_LENGTH);
    if (!content) throw new BadRequestException('评论内容不能为空');

    const hookResult = await this.pluginHost.runHook<{ blocked?: boolean; reason?: string }>(
      'comment.beforeCreate',
      {
        siteId: site.id,
        novelId: novel.id,
        novelTitle: novel.title,
        chapterId,
        memberId: member?.id ?? null,
        nickname,
        content,
        source: 'novel',
      },
    );
    if (hookResult?.blocked) {
      throw new BadRequestException('评论包含违规内容，已被安全策略拦截');
    }

    const auditEnabled = resolveCommentAudit(site.settings);
    const row = await this.prisma.novelComment.create({
      data: {
        siteId: site.id,
        novelId: novel.id,
        chapterId,
        memberId: member?.id ?? null,
        parentId,
        nickname,
        content,
        status: auditEnabled ? 'pending' : 'approved',
        ip: clientIp(req),
      },
    });

    await this.pluginHost.runHook('comment.afterCreate', {
      siteId: site.id,
      novelId: novel.id,
      commentId: row.id,
      status: row.status,
    });

    return { id: row.id, status: row.status };
  }

  /** GET /public/sites/:slug/members/novel-comments：当前会员的书评/章评（含书籍/章节信息） */
  async myComments(
    siteSlug: string,
    memberId: string,
    query: PageQuery,
  ): Promise<Paginated<AdminNovelComment>> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.NovelCommentWhereInput = { siteId: site.id, memberId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novelComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          novel: { select: { id: true, title: true, slug: true } },
          chapter: { select: { id: true, title: true, chapterNo: true } },
        },
      }),
      this.prisma.novelComment.count({ where }),
    ]);

    return paginate(rows.map(toAdminComment), total, page, pageSize);
  }

  /* ---------------------------- 管理端 ---------------------------- */

  /** GET /novel-comments */
  async list(siteId: string, query: QueryNovelCommentDto): Promise<Paginated<AdminNovelComment>> {
    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const keyword = query.keyword?.trim();
    const where: Prisma.NovelCommentWhereInput = {
      siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.novelId ? { novelId: query.novelId } : {}),
      ...(query.chapterId ? { chapterId: query.chapterId } : {}),
      ...(keyword
        ? {
            OR: [{ content: { contains: keyword } }, { nickname: { contains: keyword } }],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novelComment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          novel: { select: { id: true, title: true, slug: true } },
          chapter: { select: { id: true, title: true, chapterNo: true } },
        },
      }),
      this.prisma.novelComment.count({ where }),
    ]);

    return paginate(rows.map(toAdminComment), total, page, pageSize);
  }

  /** PATCH /novel-comments/:id/status */
  async setStatus(
    siteId: string,
    id: string,
    status: 'approved' | 'rejected',
    req?: AuthenticatedRequest,
  ): Promise<AdminNovelComment> {
    const existing = await this.prisma.novelComment.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('评论不存在');

    const row = await this.prisma.novelComment.update({
      where: { id },
      data: { status },
      include: {
        novel: { select: { id: true, title: true, slug: true } },
        chapter: { select: { id: true, title: true, chapterNo: true } },
      },
    });
    await this.audit.log(req, {
      action: 'comment.update',
      resource: 'novel_comment',
      resourceId: id,
      detail: { status, from: existing.status, novelId: existing.novelId },
    });
    return toAdminComment(row);
  }

  /** DELETE /novel-comments/:id（子回复级联删除） */
  async remove(siteId: string, id: string, req?: AuthenticatedRequest): Promise<null> {
    const existing = await this.prisma.novelComment.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('评论不存在');

    await this.prisma.novelComment.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'comment.delete',
      resource: 'novel_comment',
      resourceId: id,
      detail: { nickname: existing.nickname, novelId: existing.novelId },
    });
    return null;
  }
}
