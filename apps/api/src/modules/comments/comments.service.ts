import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Comment, PageQuery, Paginated, PublicComment } from '@wmcms/shared';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { clientIp, userAgent } from '../../common/utils/request.util';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import type { AuthenticatedRequest } from '../../common/types';
import { QueryCommentDto } from './dto/query-comment.dto';
import { BatchCommentsDto, CreatePublicCommentDto } from './dto/comment-ops.dto';

type CommentWithArticle = Prisma.CommentGetPayload<{
  include: { article: { select: { id: true; title: true; slug: true } } };
}>;

type PublicCommentRow = Prisma.CommentGetPayload<{
  include: { member: { select: { id: true; nickname: true; avatar: true } } };
}>;

/** 评论内容上限（与共享契约 / 插件校验保持一致） */
const CONTENT_MAX_LENGTH = 2000;
/** 同 IP 相同内容的重复提交抑制窗口（毫秒） */
const DUPLICATE_WINDOW_MS = 60_000;
/** 区块审核默认开启 */
const DEFAULT_COMMENT_AUDIT = true;
/** 公开评论树单次返回上限（爆款文章不至于一次拉回数万条） */
const PUBLIC_TREE_LIMIT = 500;
/** 允许的最大回复层级：根评论 = 0，最多再嵌套 3 层 */
const MAX_COMMENT_DEPTH = 3;

function toComment(row: CommentWithArticle): Comment {
  return {
    id: row.id,
    siteId: row.siteId,
    articleId: row.articleId,
    memberId: row.memberId,
    parentId: row.parentId,
    nickname: row.nickname,
    email: row.email,
    content: row.content,
    status: row.status as Comment['status'],
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    article: row.article
      ? { id: row.article.id, title: row.article.title, slug: row.article.slug }
      : null,
  };
}

/** 出库容错 parse：站点 settings JSON 字符串 → 对象 */
function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pluginHost: PluginHostService,
  ) {}

  /* ---------------------------- 管理端 ---------------------------- */

  async list(siteId: string, query: QueryCommentDto): Promise<Paginated<Comment>> {
    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const keyword = query.keyword?.trim();
    const where: Prisma.CommentWhereInput = {
      siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.articleId ? { articleId: query.articleId } : {}),
      ...(keyword
        ? {
            OR: [{ content: { contains: keyword } }, { nickname: { contains: keyword } }],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { article: { select: { id: true, title: true, slug: true } } },
      }),
      this.prisma.comment.count({ where }),
    ]);

    return paginate(rows.map(toComment), total, page, pageSize);
  }

  async setStatus(
    siteId: string,
    id: string,
    status: 'approved' | 'rejected',
    req?: AuthenticatedRequest,
  ): Promise<Comment> {
    const existing = await this.prisma.comment.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('评论不存在');

    const row = await this.prisma.comment.update({
      where: { id },
      data: { status },
      include: { article: { select: { id: true, title: true, slug: true } } },
    });
    await this.audit.log(req, {
      action: 'comment.update',
      resource: 'comment',
      resourceId: id,
      detail: { status, from: existing.status },
    });
    return toComment(row);
  }

  async remove(siteId: string, id: string, req?: AuthenticatedRequest): Promise<null> {
    const existing = await this.prisma.comment.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('评论不存在');

    await this.prisma.comment.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'comment.delete',
      resource: 'comment',
      resourceId: id,
      detail: { nickname: existing.nickname },
    });
    return null;
  }

  async batch(
    siteId: string,
    dto: BatchCommentsDto,
    req?: AuthenticatedRequest,
  ): Promise<{ affected: number }> {
    const where: Prisma.CommentWhereInput = { siteId, id: { in: dto.ids } };
    let affected = 0;

    if (dto.action === 'delete') {
      const result = await this.prisma.comment.deleteMany({ where });
      affected = result.count;
    } else {
      const result = await this.prisma.comment.updateMany({
        where,
        data: { status: dto.action === 'approve' ? 'approved' : 'rejected' },
      });
      affected = result.count;
    }

    await this.audit.log(req, {
      action: 'comment.batch',
      resource: 'comment',
      detail: { action: dto.action, ids: dto.ids, affected },
    });
    return { affected };
  }

  /* ---------------------------- 门户 ---------------------------- */

  /** 站点内已通过审核的评论（树形 PublicComment[]） */
  async publicTree(siteSlug: string, articleSlug: string): Promise<PublicComment[]> {
    const site = await this.resolveSite(siteSlug);
    const article = await this.resolveArticle(site.id, articleSlug);

    const rows = await this.prisma.comment.findMany({
      where: { siteId: site.id, articleId: article.id, status: 'approved' },
      orderBy: { createdAt: 'asc' },
      take: PUBLIC_TREE_LIMIT,
      // 只取渲染需要的会员字段（不要 include:true，避免把 password/email 读进进程）
      include: { member: { select: { id: true, nickname: true, avatar: true } } },
    });

    return buildTree(rows.map(toPublicComment));
  }

  /** 门户提交评论（匿名 / 会员） */
  async createPublic(
    siteSlug: string,
    articleSlug: string,
    dto: CreatePublicCommentDto,
    req: AuthenticatedRequest,
  ): Promise<Comment> {
    const site = await this.resolveSite(siteSlug);
    const article = await this.resolveArticle(site.id, articleSlug);

    // 1) 正文清洗（先清洗再交给插件，避免 HTML 标签绕过敏感词检测）
    const content = sanitizePlainText(dto.content, CONTENT_MAX_LENGTH);
    if (!content) throw new BadRequestException('评论内容不能为空');

    // 2) 会员身份（可选登录）：仅接受与当前站点一致的会员
    const memberId = req.member?.id ?? null;
    let memberNickname: string | null = null;
    let memberEmail: string | null = null;
    let effectiveMemberId: string | null = null;
    if (memberId) {
      const member = await this.prisma.member.findFirst({
        where: { id: memberId, siteId: site.id, status: 'active' },
      });
      if (member) {
        effectiveMemberId = member.id;
        memberNickname = member.nickname || member.username;
        memberEmail = member.email;
      }
    }

    // 3) 匿名时昵称必填
    const nicknameInput = sanitizePlainText(dto.nickname, 30);
    const nickname = memberNickname ?? nicknameInput;
    if (!nickname) throw new BadRequestException('请填写昵称');

    // 4) 父评论校验 + 层级限制（避免无限嵌套拖垮递归渲染）
    let parentId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, siteId: site.id, articleId: article.id },
        select: { id: true, parentId: true },
      });
      if (!parent) throw new BadRequestException('回复的评论不存在');
      const parentDepth = await this.commentDepth(parent);
      if (parentDepth + 1 > MAX_COMMENT_DEPTH) {
        throw new BadRequestException(
          `回复层级最多 ${MAX_COMMENT_DEPTH} 层，请直接回复上层评论`,
        );
      }
      parentId = parent.id;
    }

    // 5) 插件钩子：评论安全策略拦截
    const hookResult = await this.pluginHost.runHook<{ blocked?: boolean; reason?: string }>(
      'comment.beforeCreate',
      {
        siteId: site.id,
        articleId: article.id,
        memberId: effectiveMemberId,
        nickname,
        email: dto.email ?? memberEmail,
        content,
      },
    );
    if (hookResult?.blocked) {
      throw new BadRequestException('评论包含违规内容，已被安全策略拦截');
    }

    // 6) 同 IP 60 秒内相同内容 → 429
    const ip = clientIp(req);
    if (ip) {
      const duplicated = await this.prisma.comment.findFirst({
        where: {
          siteId: site.id,
          ip,
          content,
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (duplicated) {
        throw new HttpException('提交过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // 7) 按站点设置决定是否进入审核队列
    const auditEnabled = this.resolveCommentAudit(site.settings);
    const row = await this.prisma.comment.create({
      data: {
        siteId: site.id,
        articleId: article.id,
        memberId: effectiveMemberId,
        parentId,
        nickname,
        email: (dto.email ?? memberEmail ?? null) || null,
        content,
        status: auditEnabled ? 'pending' : 'approved',
        ip,
        userAgent: userAgent(req),
      },
      include: { article: { select: { id: true, title: true, slug: true } } },
    });

    // 8) 入库后钩子（通知 / 计数等，失败不影响主流程）
    await this.pluginHost.runHook('comment.afterCreate', {
      siteId: site.id,
      articleId: article.id,
      comment: row,
    });

    return toComment(row);
  }

  /* ---------------------------- 内部工具 ---------------------------- */

  private async resolveSite(siteSlug: string) {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug } });
    if (!site || site.status !== 'enabled') {
      throw new NotFoundException('站点不存在或已停用');
    }
    return site;
  }

  private async resolveArticle(siteId: string, articleSlug: string) {
    const article = await this.prisma.article.findFirst({
      // 草稿/归档不可评论：否则会产生挂不上前台的脏数据，并可被用来探测未发布 slug
      where: { siteId, slug: articleSlug, status: 'published' },
      select: { id: true, title: true, slug: true },
    });
    if (!article) throw new NotFoundException('文章不存在');
    return article;
  }

  /**
   * 评论深度（根评论 = 0）。
   * 向上最多走 MAX_COMMENT_DEPTH 层即可判定，顺带用 visited 集合防止脏数据成环。
   */
  private async commentDepth(node: { id: string; parentId: string | null }): Promise<number> {
    let depth = 0;
    let cursor = node.parentId;
    const seen = new Set<string>([node.id]);
    while (cursor && depth < MAX_COMMENT_DEPTH) {
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const parent: { parentId: string | null } | null = await this.prisma.comment.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      if (!parent) break;
      depth += 1;
      cursor = parent.parentId;
    }
    return depth;
  }

  /** 站点 settings.commentAudit（默认 true） */
  private resolveCommentAudit(settings: string | null): boolean {
    const parsed = parseJsonObject(settings);
    return typeof parsed.commentAudit === 'boolean' ? parsed.commentAudit : DEFAULT_COMMENT_AUDIT;
  }
}

function toPublicComment(row: PublicCommentRow): PublicComment {
  return {
    id: row.id,
    parentId: row.parentId,
    nickname: row.nickname,
    avatar: row.member?.avatar ?? null,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    children: [],
  };
}

/**
 * 扁平列表 → 树形（孤儿节点提升为根，避免因审核状态导致评论丢失）。
 *
 * 同时兜底层级：超过 MAX_COMMENT_DEPTH 的历史回复挂到「允许的最深祖先」下，
 * 既不会产生无限递归，也不会把整条线程拉平成互不相关的根节点。
 */
function buildTree(rows: PublicComment[]): PublicComment[] {
  const map = new Map<string, PublicComment>();
  for (const row of rows) map.set(row.id, { ...row, children: [] });

  const roots: PublicComment[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    // 收集祖先链（chain[0] = 直接父级），环/断链时提前停止
    const chain: string[] = [];
    const seen = new Set<string>([row.id]);
    let cursor: string | null = row.parentId;
    while (cursor) {
      if (seen.has(cursor) || !map.has(cursor)) break;
      seen.add(cursor);
      chain.push(cursor);
      cursor = map.get(cursor)!.parentId;
    }
    if (!chain.length) {
      roots.push(node);
      continue;
    }
    // chain[i] 是「距本节点 i+1 层」的祖先；本节点渲染深度 = chain.length。
    // 超深时挂到「渲染深度为 MAX-1 的祖先」下，让本节点恰好落在第 MAX 层。
    const attachTo =
      chain.length > MAX_COMMENT_DEPTH
        ? chain[chain.length - MAX_COMMENT_DEPTH]
        : chain[0];
    const parent = map.get(attachTo);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
