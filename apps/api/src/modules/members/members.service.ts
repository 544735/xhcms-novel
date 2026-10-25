import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type Member as PrismaMember } from '@prisma/client';
import { compareSync, hashSync } from 'bcryptjs';
import type { Comment, Member, PageQuery, Paginated, PublicMember } from '@wmcms/shared';
import { JWT_SECRETS, type JwtSecrets } from '../../common/auth/jwt-config.module';
import { Inject } from '@nestjs/common';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthenticatedRequest, MemberJwtPayload } from '../../common/types';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { QueryMemberDto } from './dto/query-member.dto';
import { LoginMemberDto, RegisterMemberDto, UpdateMemberProfileDto } from './dto/member-auth.dto';

type MemberRow = PrismaMember & { _count?: { comments: number } };

const PASSWORD_ROUNDS = 10;
/** 会员令牌有效期：7 天（契约） */
const MEMBER_TOKEN_TTL = '7d';

/** 数据库会员行 → 契约 Member */
export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    siteId: row.siteId,
    username: row.username,
    email: row.email,
    nickname: row.nickname,
    avatar: row.avatar,
    status: row.status as Member['status'],
    points: row.points,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    ...(row._count ? { commentCount: row._count.comments } : {}),
  };
}

/** 数据库会员行 → 门户公开资料（不暴露状态/最后登录等管理字段） */
export function toPublicMember(row: PrismaMember): PublicMember {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    email: row.email,
    points: row.points,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface MemberLoginResult {
  member: PublicMember;
  token: string;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  /* ---------------------------- 管理端 ---------------------------- */

  async list(siteId: string, query: QueryMemberDto): Promise<Paginated<Member>> {
    const { page, pageSize, skip, take } = normalizePage(query as PageQuery);
    const keyword = query.keyword?.trim();
    const where: Prisma.MemberWhereInput = {
      siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(keyword
        ? {
            OR: [
              { username: { contains: keyword } },
              { email: { contains: keyword } },
              { nickname: { contains: keyword } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { _count: { select: { comments: true } } },
      }),
      this.prisma.member.count({ where }),
    ]);

    return paginate(rows.map(toMember), total, page, pageSize);
  }

  async get(siteId: string, id: string): Promise<Member> {
    const row = await this.prisma.member.findFirst({
      where: { id, siteId },
      include: { _count: { select: { comments: true } } },
    });
    if (!row) throw new NotFoundException('会员不存在');
    return toMember(row);
  }

  async create(siteId: string, dto: CreateMemberDto, req?: AuthenticatedRequest): Promise<Member> {
    await this.assertUnique(siteId, dto.username, dto.email);

    const row = await this.prisma.member.create({
      data: {
        siteId,
        username: dto.username.trim(),
        email: dto.email.trim().toLowerCase(),
        password: hashSync(dto.password, PASSWORD_ROUNDS),
        nickname: dto.nickname ?? null,
        avatar: dto.avatar ?? null,
        status: dto.status ?? 'active',
        points: dto.points ?? 0,
      },
      include: { _count: { select: { comments: true } } },
    });

    await this.audit.log(req, {
      action: 'member.create',
      resource: 'member',
      resourceId: row.id,
      detail: { username: row.username, email: row.email, status: row.status },
    });

    return toMember(row);
  }

  async update(
    siteId: string,
    id: string,
    dto: UpdateMemberDto,
    req?: AuthenticatedRequest,
  ): Promise<Member> {
    const existing = await this.prisma.member.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('会员不存在');

    if (dto.username || dto.email) {
      await this.assertUnique(siteId, dto.username, dto.email, id);
    }

    const data: Prisma.MemberUpdateInput = {};
    if (dto.username !== undefined) data.username = dto.username.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.points !== undefined) data.points = dto.points;
    if (dto.password) data.password = hashSync(dto.password, PASSWORD_ROUNDS);

    const row = await this.prisma.member.update({
      where: { id },
      data,
      include: { _count: { select: { comments: true } } },
    });

    await this.audit.log(req, {
      action: 'member.update',
      resource: 'member',
      resourceId: id,
      detail: { fields: Object.keys(data), passwordReset: Boolean(dto.password) },
    });

    return toMember(row);
  }

  async remove(siteId: string, id: string, req?: AuthenticatedRequest): Promise<null> {
    const existing = await this.prisma.member.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('会员不存在');

    await this.prisma.member.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'member.delete',
      resource: 'member',
      resourceId: id,
      detail: { username: existing.username },
    });
    return null;
  }

  async setStatus(
    siteId: string,
    id: string,
    status: 'active' | 'disabled',
    req?: AuthenticatedRequest,
  ): Promise<Member> {
    const existing = await this.prisma.member.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('会员不存在');

    const row = await this.prisma.member.update({
      where: { id },
      data: { status },
      include: { _count: { select: { comments: true } } },
    });
    await this.audit.log(req, {
      action: 'member.status',
      resource: 'member',
      resourceId: id,
      detail: { status },
    });
    return toMember(row);
  }

  async resetPassword(
    siteId: string,
    id: string,
    password: string,
    req?: AuthenticatedRequest,
  ): Promise<null> {
    const existing = await this.prisma.member.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('会员不存在');

    await this.prisma.member.update({
      where: { id },
      data: { password: hashSync(password, PASSWORD_ROUNDS) },
    });
    await this.audit.log(req, {
      action: 'member.reset_password',
      resource: 'member',
      resourceId: id,
      detail: { username: existing.username },
    });
    return null;
  }

  /* ---------------------------- 门户 ---------------------------- */

  /** 按 slug 解析启用中的站点 */
  async resolveSite(siteSlug: string) {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug } });
    if (!site || site.status !== 'enabled') {
      throw new NotFoundException('站点不存在或已停用');
    }
    return site;
  }

  async register(siteSlug: string, dto: RegisterMemberDto): Promise<MemberLoginResult> {
    const site = await this.resolveSite(siteSlug);
    await this.assertUnique(site.id, dto.username, dto.email);

    const row = await this.prisma.member.create({
      data: {
        siteId: site.id,
        username: dto.username.trim(),
        email: dto.email.trim().toLowerCase(),
        password: hashSync(dto.password, PASSWORD_ROUNDS),
        nickname: dto.nickname?.trim() || dto.username.trim(),
        status: 'active',
        points: 0,
        lastLoginAt: new Date(),
      },
    });

    return { member: toPublicMember(row), token: await this.signToken(row) };
  }

  async login(siteSlug: string, dto: LoginMemberDto): Promise<MemberLoginResult> {
    const site = await this.resolveSite(siteSlug);
    const account = dto.account.trim();

    const row = await this.prisma.member.findFirst({
      where: {
        siteId: site.id,
        OR: [{ username: account }, { email: account.toLowerCase() }],
      },
    });
    if (!row || !compareSync(dto.password, row.password)) {
      throw new UnauthorizedException('账号或密码不正确');
    }
    if (row.status !== 'active') {
      throw new ForbiddenException('该会员账号已被禁用，请联系站点管理员');
    }

    const updated = await this.prisma.member.update({
      where: { id: row.id },
      data: { lastLoginAt: new Date() },
    });

    return { member: toPublicMember(updated), token: await this.signToken(updated) };
  }

  /** 会员资料（需 MemberAuthGuard 已解析 req.member） */
  async profile(siteSlug: string, memberId: string): Promise<PublicMember> {
    const site = await this.resolveSite(siteSlug);
    const row = await this.prisma.member.findFirst({ where: { id: memberId, siteId: site.id } });
    if (!row) throw new UnauthorizedException('会员登录状态已失效，请重新登录');
    return toPublicMember(row);
  }

  async updateProfile(
    siteSlug: string,
    memberId: string,
    dto: UpdateMemberProfileDto,
  ): Promise<PublicMember> {
    const site = await this.resolveSite(siteSlug);
    const existing = await this.prisma.member.findFirst({
      where: { id: memberId, siteId: site.id },
    });
    if (!existing) throw new UnauthorizedException('会员登录状态已失效，请重新登录');

    const data: Prisma.MemberUpdateInput = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.password) data.password = hashSync(dto.password, PASSWORD_ROUNDS);

    const row = await this.prisma.member.update({ where: { id: memberId }, data });
    return toPublicMember(row);
  }

  /** 会员「我的评论」 */
  async myComments(
    siteSlug: string,
    memberId: string,
    query: PageQuery,
  ): Promise<Paginated<Comment>> {
    const site = await this.resolveSite(siteSlug);
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.CommentWhereInput = { siteId: site.id, memberId };

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

    const items: Comment[] = rows.map((row) => ({
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
      article: row.article ? { id: row.article.id, title: row.article.title, slug: row.article.slug } : null,
    }));

    return paginate(items, total, page, pageSize);
  }

  /* ---------------------------- 内部工具 ---------------------------- */

  private async signToken(member: PrismaMember): Promise<string> {
    const payload: MemberJwtPayload = {
      sub: member.id,
      type: 'member',
      siteId: member.siteId,
      username: member.username,
    };
    return this.jwt.signAsync(payload, {
      secret: this.secrets.member,
      expiresIn: MEMBER_TOKEN_TTL,
    });
  }

  /** 用户名 / 邮箱站点内唯一校验（excludeId 用于更新场景） */
  private async assertUnique(
    siteId: string,
    username?: string,
    email?: string,
    excludeId?: string,
  ): Promise<void> {
    if (username) {
      const dup = await this.prisma.member.findFirst({
        where: { siteId, username: username.trim(), ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      if (dup) throw new ConflictException('该用户名已被占用');
    }
    if (email) {
      const dup = await this.prisma.member.findFirst({
        where: {
          siteId,
          email: email.trim().toLowerCase(),
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (dup) throw new ConflictException('该邮箱已被注册');
    }
  }
}
