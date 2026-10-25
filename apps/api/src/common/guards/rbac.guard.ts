import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthContextService } from '../auth/auth-context.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../types';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authContext: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('请先登录');
    }

    const ctx = await this.authContext.load(req.user.id);
    if (!ctx) {
      throw new UnauthorizedException('账号不存在或已被删除');
    }
    if (ctx.status !== 'active') {
      throw new ForbiddenException('账号已被禁用，请联系管理员');
    }
    req.authContext = ctx;

    if (ctx.isSuperAdmin) return true;

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length) {
      const missing = required.filter((code) => !ctx.permissionCodes.has(code));
      if (missing.length) {
        throw new ForbiddenException(`缺少权限：${missing.join('、')}`);
      }
    }

    const requiredAny = this.reflector.getAllAndOverride<string[]>(REQUIRED_ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredAny?.length && !requiredAny.some((code) => ctx.permissionCodes.has(code))) {
      throw new ForbiddenException('缺少访问该资源的权限');
    }

    return true;
  }
}
