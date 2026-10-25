import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { SettingsMap } from '@wmcms/shared';
import {
  CurrentUser,
  OptionalSiteId,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('系统设置')
@ApiBearerAuth('admin')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions('setting:view')
  @ApiQuery({ name: 'siteId', required: false, description: '站点 ID；缺省为全局设置' })
  @ApiOperation({ summary: '读取设置（按 group 聚合；siteId 缺省返回全局设置）' })
  list(
    @OptionalSiteId() siteId: string | undefined,
    @CurrentUser() user: AuthContext,
  ): Promise<SettingsMap> {
    return this.settings.read(siteId, user);
  }

  @Put()
  @RequirePermissions('setting:update')
  @ApiOperation({ summary: '保存设置（批量 upsert，返回更新后的 SettingsMap）' })
  save(
    @Body() dto: UpdateSettingsDto,
    @OptionalSiteId() headerSiteId: string | undefined,
    @CurrentUser() user: AuthContext,
    @Req() req: AuthenticatedRequest,
  ): Promise<SettingsMap> {
    return this.settings.save(dto, headerSiteId, user, req);
  }
}
