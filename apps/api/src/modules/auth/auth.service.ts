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
import { JWT_SECRETS } from '../../common/auth/jwt-config.module';
import type { JwtSecrets } from '../../common/auth/jwt-config.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest, JwtPayload } from '../../common/types';
import { clientIp } from '../../common/utils/request.util';
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
    @Inject(JWT_SECRETS) private readonly secrets: JwtSecrets,
  ) {}

  async login(dto: LoginDto, req: AuthenticatedRequest): Promise<LoginResult> {
    const username = dto.username.trim();
    const user = await this.prisma.user.findUnique({ where: { username } });
    // 账号不存在与密码错误返回同一提示，避免账号枚举
    if (!user) throw new UnauthorizedException('账号或密码错误');
    const passwordMatched = await compare(dto.password, user.password);
    if (!passwordMatched) throw new UnauthorizedException('账号或密码错误');
    if (user.status !== 'active') throw new ForbiddenException('账号已被禁用');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: clientIp(req) },
    });

    const tokens = await this.signTokens(updated);
    const profile = await this.buildProfile(updated.id);
    await this.auditLogin(req, updated);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: profile };
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.secrets.refresh,
      });
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('令牌类型不正确');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('账号不存在或已被删除');
    if (user.status !== 'active') throw new ForbiddenException('账号已被禁用');
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
    await this.prisma.user.update({ where: { id: userId }, data: { password } });
    await this.audit.log(req, {
      action: 'auth.password',
      resource: 'auth',
      resourceId: userId,
      detail: { username: user.username },
    });
    return null;
  }

  async logout(req: AuthenticatedRequest): Promise<null> {
    await this.audit.log(req, {
      action: 'auth.logout',
      resource: 'auth',
      resourceId: req.authContext?.id ?? null,
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

  private async signTokens(user: { id: string; username: string }): Promise<RefreshResult> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'access',
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'refresh',
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
    },
  ): Promise<void> {
    req.authContext = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
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
}
