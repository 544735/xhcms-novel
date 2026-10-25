import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRETS, type JwtSecrets } from '../auth/jwt-config.module';
import { extractBearerToken } from './jwt-auth.guard';
import type { AuthenticatedRequest, MemberJwtPayload } from '../types';

async function verifyMemberToken(
  req: AuthenticatedRequest,
  jwt: JwtService,
  secrets: JwtSecrets,
  required: boolean,
): Promise<boolean> {
  const token = extractBearerToken(req);
  if (!token) {
    if (required) throw new UnauthorizedException('请先登录会员账号');
    return true;
  }
  try {
    const payload = await jwt.verifyAsync<MemberJwtPayload>(token, { secret: secrets.member });
    if (payload.type !== 'member') throw new Error('invalid token type');
    req.member = { id: payload.sub, username: payload.username, siteId: payload.siteId };
    return true;
  } catch {
    if (required) throw new UnauthorizedException('会员登录状态已失效，请重新登录');
    return true;
  }
}

/** 门户会员必登录接口使用（控制器需同时标注 @Public() 跳过管理员鉴权） */
@Injectable()
export class MemberAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return verifyMemberToken(req, this.jwt, this.secrets, true);
  }
}

/** 门户可选登录接口（评论/表单）：无 token 或 token 失效时按匿名处理 */
@Injectable()
export class OptionalMemberAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await verifyMemberToken(req, this.jwt, this.secrets, false);
    return true;
  }
}
