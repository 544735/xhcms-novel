import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest, JwtPayload } from '../types';

export function extractBearerToken(req: AuthenticatedRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = String(header).split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/**
 * 管理端 JWT 校验。只做签名与令牌类型校验；
 * 账号状态与权限由 RbacGuard 从数据库（带短缓存）解析，保证禁用/改权立即生效。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      if (payload.type !== 'access') {
        throw new UnauthorizedException('令牌类型不正确');
      }
      req.user = { id: payload.sub, username: payload.username, type: 'access' };
      return true;
    } catch {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
  }
}
