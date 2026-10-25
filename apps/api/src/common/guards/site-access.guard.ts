import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_SITE_SCOPED_KEY } from '../decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../types';

export function readSiteId(req: AuthenticatedRequest): string | undefined {
  const header = req.headers['x-site-id'];
  const value = Array.isArray(header) ? header[0] : header;
  const fromHeader = value ? String(value).trim() : '';
  if (fromHeader) return fromHeader;
  const fromQuery = req.query?.siteId;
  return typeof fromQuery === 'string' && fromQuery.trim() ? fromQuery.trim() : undefined;
}

/**
 * 站点级接口鉴权：必须携带 X-Site-Id，且非超管必须被授权该站点。
 * 依赖 RbacGuard 已填充的 authContext。
 */
@Injectable()
export class SiteAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const scoped = this.reflector.getAllAndOverride<boolean>(IS_SITE_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!scoped) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const siteId = readSiteId(req);
    if (!siteId) {
      throw new BadRequestException('缺少站点上下文 X-Site-Id');
    }

    const auth = req.authContext;
    if (!auth) {
      throw new UnauthorizedException('请先登录');
    }
    if (!auth.isSuperAdmin && !auth.siteIds.has(siteId)) {
      throw new ForbiddenException('无权访问该站点');
    }

    req.siteId = siteId;
    return true;
  }
}
