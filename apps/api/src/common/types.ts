import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
  /** 令牌版本：与 user.tokenVersion 不一致即视为失效 */
  ver?: number;
  iat?: number;
  exp?: number;
}

export interface MemberJwtPayload {
  sub: string;
  type: 'member';
  siteId: string;
  username: string;
  /** 令牌版本：与 member.tokenVersion 不一致即视为失效 */
  ver?: number;
  iat?: number;
  exp?: number;
}

/** 经过 RBAC 守卫加载后的请求用户上下文 */
export interface AuthContext {
  id: string;
  username: string;
  nickname: string | null;
  isSuperAdmin: boolean;
  status: string;
  /** 令牌版本：改密/登出/禁用时自增，用于判定旧令牌失效 */
  tokenVersion: number;
  permissionCodes: Set<string>;
  siteIds: Set<string>;
}

export interface AuthMember {
  id: string;
  username: string;
  siteId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; type: 'access' | 'refresh'; tokenVersion?: number };
  authContext?: AuthContext;
  siteId?: string;
  member?: AuthMember;
}

export interface FileUpload {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
