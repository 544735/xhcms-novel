import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRETS, type JwtSecrets } from '../auth/jwt-config.module';
import { PrismaService } from '../prisma/prisma.service';
import { extractBearerToken } from './jwt-auth.guard';
import type { AuthenticatedRequest, MemberJwtPayload } from '../types';

/**
 * 校验会员令牌：验签 + 每请求查库（状态 / 令牌版本 / 站点归属）。
 * 旧令牌未携带 ver 时放行至过期，但状态与站点归属每请求都会校验，
 * 因此会员被禁用/删除、或改密后自增 tokenVersion，旧令牌都会立即失效。
 */
async function verifyMemberToken(
  req: AuthenticatedRequest,
  jwt: JwtService,
  secrets: JwtSecrets,
  prisma: PrismaService,
  required: boolean,
): Promise<boolean> {
  /** 失效处理：必登录接口抛 401；可选登录接口清空身份后静默降级为匿名 */
  const fail = (message: string): boolean => {
    req.member = undefined;
    if (required) throw new UnauthorizedException(message);
    return true;
  };

  const token = extractBearerToken(req);
  if (!token) {
    return required ? fail('请先登录会员账号') : true;
  }

  try {
    const payload = await jwt.verifyAsync<MemberJwtPayload>(token, { secret: secrets.member });
    if (payload.type !== 'member') return fail('会员登录状态已失效，请重新登录');

    // 每请求查库：会员被删除 / 禁用 / 改密（tokenVersion 自增）后旧令牌立即失效
    const member = await prisma.member.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, siteId: true, status: true, tokenVersion: true },
    });
    if (!member || member.status !== 'active') {
      return fail('会员登录状态已失效，请重新登录');
    }
    // 旧令牌未携带 ver 时放行至过期（兼容），其余情况必须与库中版本一致
    if (payload.ver !== undefined && payload.ver !== member.tokenVersion) {
      return fail('会员登录状态已失效，请重新登录');
    }
    // 防跨站串用：令牌内站点必须与会员实际归属一致，查询也只信任数据库
    if (member.siteId !== payload.siteId) {
      return fail('会员登录状态已失效，请重新登录');
    }

    // 身份一律以数据库为准，不信任令牌内的 username / siteId
    req.member = { id: member.id, username: member.username, siteId: member.siteId };
    return true;
  } catch {
    return fail('会员登录状态已失效，请重新登录');
  }
}

/** 门户会员必登录接口使用（控制器需同时标注 @Public() 跳过管理员鉴权） */
@Injectable()
export class MemberAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return verifyMemberToken(req, this.jwt, this.secrets, this.prisma, true);
  }
}

/** 门户可选登录接口（评论/表单）：无 token 或 token 失效时按匿名处理，绝不抛错 */
@Injectable()
export class OptionalMemberAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await verifyMemberToken(req, this.jwt, this.secrets, this.prisma, false);
    return true;
  }
}
