import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { PublicThemePayload } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ThemesService } from './themes.service';

/** 门户公开接口：站点当前主题 */
@ApiTags('门户-主题')
@Public()
@Controller('public/sites/:siteSlug')
export class PublicThemeController {
  constructor(private readonly themes: ThemesService) {}

  @Get('theme')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '获取站点当前主题与配置' })
  theme(@Param('siteSlug') siteSlug: string): Promise<PublicThemePayload> {
    return this.themes.publicTheme(siteSlug);
  }
}
