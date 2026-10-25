import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CollectTask, Paginated } from '@wmcms/shared';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { CollectService } from './collect.service';
import { QueryCollectTaskDto } from './dto/query-collect-task.dto';
import { RunCollectDto } from './dto/run-collect.dto';

@ApiTags('采集-任务')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('collect')
export class CollectController {
  constructor(private readonly collect: CollectService) {}

  @Post('run')
  @RequirePermissions('collect:run')
  @ApiOperation({
    summary: '正式采集（同步执行）：新建书籍或向已有书籍追加章节，返回最终任务记录',
  })
  run(
    @Body() dto: RunCollectDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<CollectTask> {
    return this.collect.run(dto, siteId, req);
  }

  @Get('tasks')
  @RequirePermissions('collect:view')
  @ApiOperation({ summary: '采集任务列表（分页，含 sourceName/novelTitle）' })
  tasks(
    @Query() query: QueryCollectTaskDto,
    @CurrentSiteId() siteId: string,
  ): Promise<Paginated<CollectTask>> {
    return this.collect.listTasks(query, siteId);
  }

  @Get('tasks/:id')
  @RequirePermissions('collect:view')
  @ApiOperation({ summary: '采集任务详情' })
  task(@Param('id') id: string, @CurrentSiteId() siteId: string): Promise<CollectTask> {
    return this.collect.findTask(id, siteId);
  }
}
