import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Site, Theme } from '@wmcms/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { ActivateThemeDto } from './dto/activate-theme.dto';
import { ThemesService } from './themes.service';

@ApiTags('主题')
@ApiBearerAuth('admin')
@Controller('themes')
export class ThemesController {
  constructor(private readonly themes: ThemesService) {}

  @Get()
  @RequirePermissions('theme:view')
  @ApiOperation({ summary: '主题列表（含 activeSites 使用数）' })
  list(): Promise<Theme[]> {
    return this.themes.list();
  }

  @Post('activate')
  @RequirePermissions('theme:update')
  @ApiOperation({ summary: '切换站点主题' })
  activate(
    @Body() dto: ActivateThemeDto,
    @CurrentUser() user: AuthContext,
    @Req() req: AuthenticatedRequest,
  ): Promise<Site> {
    return this.themes.activate(dto, user, req);
  }
}
