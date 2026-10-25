import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface MemberJwtPayload {
  sub: string;
  type: 'member';
  siteId: string;
  username: string;
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
  permissionCodes: Set<string>;
  siteIds: Set<string>;
}

export interface AuthMember {
  id: string;
  username: string;
  siteId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; type: 'access' | 'refresh' };
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
