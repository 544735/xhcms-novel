import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { PublicSite } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { SitesService, toPublicSite } from './sites.service';

/** 门户公开接口：站点基本信息（按 slug 解析） */
@ApiTags('门户-站点')
@Public()
@Controller('public/sites/:siteSlug')
export class PublicSitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '获取公开站点信息' })
  async site(@Param('siteSlug') siteSlug: string): Promise<PublicSite> {
    const site = await this.sites.resolvePublicSite(siteSlug);
    return toPublicSite(site);
  }
}
