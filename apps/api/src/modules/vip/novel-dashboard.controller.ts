import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { NovelDashboardService, type NovelStatsResult } from './novel-dashboard.service';

@ApiTags('小说仪表盘')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('dashboard')
export class NovelDashboardController {
  constructor(private readonly dashboard: NovelDashboardService) {}

  @Get('novel-stats')
  @RequirePermissions('dashboard:view')
  @ApiOperation({
    summary: '小说站统计（书籍/章节/营收/会员/阅读/待审作者/待审评论/采集任务 + 插件 insights）',
  })
  stats(@CurrentSiteId() siteId: string): Promise<NovelStatsResult> {
    return this.dashboard.stats(siteId);
  }
}
