import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import type { LoginResult, RefreshResult, UserProfile } from '@wmcms/shared';

import { AuditService } from '../../common/audit/audit.service';
import { AuthContextService } from '../../common/auth/auth-context.service';
import { JWT_SECRETS } from '../../common/auth/jwt-config.module';
import type { JwtSecrets } from '../../common/auth/jwt-config.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest, JwtPayload } from '../../common/types';
import { clientIp, userAgent } from '../../common/utils/request.util';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import { toUserProfile, USER_PROFILE_INCLUDE } from './profile.util';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

/**
 * 管理端认证：登录签发 access(15m)/refresh(7d) 双令牌；
 * 令牌只携带身份，权限由 RbacGuard 每次从 DB（30s 缓存）解析。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly authContext: AuthContextService,
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  async login(dto: LoginDto, req: AuthenticatedRequest): Promise<LoginResult> {
    const username = dto.username.trim();
    const user = await this.prisma.user.findUnique({ where: { username } });
    // 账号不存在与密码错误返回同一提示，避免账号枚举；两者都留审计痕迹
    if (!user) {
      await this.auditLoginFailed(req, username, 'user_not_found');
      throw new UnauthorizedException('账号或密码错误');
    }
    const passwordMatched = await compare(dto.password, user.password);
    if (!passwordMatched) {
      await this.auditLoginFailed(req, username, 'bad_password', user.id);
      throw new UnauthorizedException('账号或密码错误');
    }
    if (user.status !== 'active') {
      await this.auditLoginFailed(req, username, 'disabled', user.id);
      throw new ForbiddenException('账号已被禁用');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: clientIp(req) },
    });

    const tokens = await this.signTokens(updated);
    const profile = await this.buildProfile(updated.id);
    await this.auditLogin(req, updated);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: profile };
  }

  async refresh(dto: RefreshTokenDto, req?: AuthenticatedRequest): Promise<RefreshResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.secrets.refresh,
      });
    } catch {
      await this.auditRefresh(req, null, null, 'invalid_token');
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    if (payload.type !== 'refresh') {
      await this.auditRefresh(req, null, null, 'wrong_token_type');
      throw new UnauthorizedException('令牌类型不正确');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      await this.auditRefresh(req, null, null, 'user_not_found');
      throw new UnauthorizedException('账号不存在或已被删除');
    }
    if (user.status !== 'active') {
      await this.auditRefresh(req, user.id, user.username, 'disabled');
      throw new ForbiddenException('账号已被禁用');
    }
    // 令牌版本不一致（改密 / 登出 / 禁用后发出的旧令牌，或未携带 ver 的旧格式令牌）→ 强制重新登录
    if (payload.ver !== user.tokenVersion) {
      await this.auditRefresh(req, user.id, user.username, 'token_version_mismatch');
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
    // 成功刷新同样留痕（只记身份与原因，绝不记录令牌明文）
    await this.auditRefresh(req, user.id, user.username, 'ok');
    return this.signTokens(user);
  }

  async profile(userId: string): Promise<UserProfile> {
    return this.buildProfile(userId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    req: AuthenticatedRequest,
  ): Promise<null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('管理员不存在');
    const matched = await compare(dto.oldPassword, user.password);
    if (!matched) throw new BadRequestException('原密码不正确');
    const password = await hash(dto.newPassword, BCRYPT_ROUNDS);
    // 改密后自增令牌版本，使此前签发的 access/refresh 令牌全部失效
    await this.prisma.user.update({
      where: { id: userId },
      data: { password, tokenVersion: { increment: 1 } },
    });
    await this.audit.log(req, {
      action: 'auth.password',
      resource: 'auth',
      resourceId: userId,
      detail: { username: user.username },
    });
    return null;
  }

  async logout(req: AuthenticatedRequest): Promise<null> {
    // 注销依赖 RbacGuard 已填充 authContext；兜底取 JwtAuthGuard 写入的 user
    const userId = req.authContext?.id ?? req.user?.id;
    if (userId) {
      // 自增令牌版本，使该账号已签发的 access/refresh 令牌立即失效
      await this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
      this.authContext.invalidate(userId);
    }
    await this.audit.log(req, {
      action: 'auth.logout',
      resource: 'auth',
      resourceId: userId ?? null,
      detail: { username: req.authContext?.username ?? null },
    });
    return null;
  }

  private async buildProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_PROFILE_INCLUDE,
    });
    if (!user) throw new NotFoundException('管理员不存在');
    const allSites = user.isSuperAdmin
      ? await this.prisma.site.findMany({ orderBy: { createdAt: 'asc' } })
      : [];
    return toUserProfile(user, allSites);
  }

  private async signTokens(user: {
    id: string;
    username: string;
    tokenVersion: number;
  }): Promise<RefreshResult> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'access',
      ver: user.tokenVersion,
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'refresh',
      ver: user.tokenVersion,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.secrets.access,
        expiresIn: ACCESS_TOKEN_TTL,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.secrets.refresh,
        expiresIn: REFRESH_TOKEN_TTL,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  /** 登录接口是 @Public，请求上下文尚未填充；写审计时临时补一个最小身份上下文。 */
  private async auditLogin(
    req: AuthenticatedRequest,
    user: {
      id: string;
      username: string;
      nickname: string | null;
      isSuperAdmin: boolean;
      status: string;
      tokenVersion: number;
    },
  ): Promise<void> {
    req.authContext = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
      tokenVersion: user.tokenVersion,
      permissionCodes: new Set<string>(),
      siteIds: new Set<string>(),
    };
    await this.audit.log(req, {
      action: 'auth.login',
      resource: 'auth',
      resourceId: user.id,
      detail: { username: user.username },
    });
  }

  /**
   * 登录失败留痕（账号不存在 / 密码错误 / 账号禁用）。
   * 只记录用户名与原因，绝不记录密码明文。
   */
  private async auditLoginFailed(
    req: AuthenticatedRequest,
    username: string,
    reason: 'user_not_found' | 'bad_password' | 'disabled',
    resourceId: string | null = null,
  ): Promise<void> {
    await this.audit.log(req, {
      action: 'auth.login.failed',
      resource: 'auth',
      resourceId,
      detail: {
        username,
        reason,
        ip: clientIp(req),
        ua: userAgent(req),
      },
    });
  }

  /**
   * 刷新令牌事件留痕（成功与失败都记）。
   * 只记录用户标识与原因，绝不记录令牌明文。
   */
  private async auditRefresh(
    req: AuthenticatedRequest | undefined,
    userId: string | null,
    username: string | null,
    reason:
      | 'ok'
      | 'invalid_token'
      | 'wrong_token_type'
      | 'user_not_found'
      | 'disabled'
      | 'token_version_mismatch',
  ): Promise<void> {
    await this.audit.log(req, {
      action: 'auth.refresh',
      resource: 'auth',
      resourceId: userId,
      detail: {
        username,
        reason,
        ip: req ? clientIp(req) : null,
        ua: req ? userAgent(req) : null,
      },
    });
  }
}
