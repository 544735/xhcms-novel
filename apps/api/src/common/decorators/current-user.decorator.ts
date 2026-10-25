import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { readSiteId } from '../guards/site-access.guard';
import type { AuthContext, AuthenticatedRequest, AuthMember } from '../types';

/** 获取当前登录管理员的 RBAC 上下文（RBAC 守卫已保证存在） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.authContext) {
      throw new ForbiddenException('无法解析当前登录用户');
    }
    return req.authContext;
  },
);

/**
 * 获取当前站点 ID。
 * 优先取 X-Site-Id 请求头；query.siteId 作为兜底（门户管理场景）。
 * 与 SiteAccessGuard 共用 readSiteId：query 只有字符串才被接受，
 * `?siteId=a&siteId=b` 这类数组一律视为缺失，避免把数组透传给 Prisma。
 */
export const CurrentSiteId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const siteId = readSiteId(req);
    if (!siteId) {
      throw new BadRequestException('缺少站点上下文 X-Site-Id');
    }
    return siteId;
  },
);

/** 可选站点 ID：不存在时返回 undefined（用于全局/站点共用接口） */
export const OptionalSiteId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return readSiteId(req);
  },
);

/** 获取当前会员（MemberAuthGuard 已保证存在） */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthMember => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.member) {
      throw new ForbiddenException('无法解析当前会员身份');
    }
    return req.member;
  },
);

/** 获取请求对象（用于审计日志记录 IP / UA） */
export const Req = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequest =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>(),
);
