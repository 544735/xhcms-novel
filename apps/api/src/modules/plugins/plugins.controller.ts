import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Plugin } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { PluginsService } from './plugins.service';
import { UpdatePluginDto } from './dto/update-plugin.dto';

@ApiTags('插件管理')
@ApiBearerAuth('admin')
@Controller('plugins')
export class PluginsController {
  constructor(private readonly plugins: PluginsService) {}

  @Get()
  @RequirePermissions('plugin:view')
  @ApiOperation({ summary: '插件列表（hooks 解析为数组、config 解析为对象）' })
  list(): Promise<Plugin[]> {
    return this.plugins.list();
  }

  @Get(':key')
  @RequirePermissions('plugin:view')
  @ApiOperation({ summary: '插件详情' })
  get(@Param('key') key: string): Promise<Plugin> {
    return this.plugins.get(key);
  }

  @Patch(':key')
  @RequirePermissions('plugin:update')
  @ApiOperation({
    summary: '启停 / 配置插件',
    description: '更新后立即调用 PluginHostService.reload() 热生效，返回最新插件记录。',
  })
  update(
    @Param('key') key: string,
    @Body() dto: UpdatePluginDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Plugin> {
    return this.plugins.update(key, dto, req);
  }
}
