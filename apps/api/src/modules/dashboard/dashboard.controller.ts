import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { DashboardService, type DashboardStatsResult } from './dashboard.service';

@ApiTags('仪表盘')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @RequirePermissions('dashboard:view')
  @ApiOperation({
    summary: '站点统计（含最近 7 天趋势、热门文章、待审评论与插件 insights）',
  })
  stats(@CurrentSiteId() siteId: string): Promise<DashboardStatsResult> {
    return this.dashboard.stats(siteId);
  }
}
