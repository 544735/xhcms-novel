import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { LoginResult, RefreshResult, UserProfile } from '@wmcms/shared';

import { CurrentUser, Req } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: '管理员登录（限流 10 次/分钟）' })
  login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest): Promise<LoginResult> {
    return this.authService.login(dto, req);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '用刷新令牌换取新的访问令牌' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: AuthenticatedRequest): Promise<RefreshResult> {
    return this.authService.refresh(dto, req);
  }

  @Get('profile')
  @ApiBearerAuth('admin')
  @ApiOperation({ summary: '获取当前登录管理员资料' })
  profile(@CurrentUser() user: AuthContext): Promise<UserProfile> {
    return this.authService.profile(user.id);
  }

  @Patch('password')
  @ApiBearerAuth('admin')
  @ApiOperation({ summary: '修改当前账号密码' })
  changePassword(
    @CurrentUser() user: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.authService.changePassword(user.id, dto, req);
  }

  @Post('logout')
  @ApiBearerAuth('admin')
  @ApiOperation({ summary: '退出登录（记录审计日志）' })
  logout(@Req() req: AuthenticatedRequest): Promise<null> {
    return this.authService.logout(req);
  }
}
