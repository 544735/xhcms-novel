import { Body, Controller, Delete, Param, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { NovelVolume } from '@wmcms/shared';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { UpdateVolumeDto } from './dto/update-volume.dto';
import { NovelsService } from './novels.service';

@ApiTags('书籍管理-分卷')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('volumes')
export class VolumesController {
  constructor(private readonly novels: NovelsService) {}

  @Patch(':id')
  @RequirePermissions('novel:update')
  @ApiParam({ name: 'id', description: '分卷 ID' })
  @ApiOperation({ summary: '更新分卷（标题/排序）' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVolumeDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NovelVolume> {
    return this.novels.updateVolume(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('novel:update')
  @ApiParam({ name: 'id', description: '分卷 ID' })
  @ApiOperation({ summary: '删除分卷（旗下章节自动转为未分卷）' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.novels.removeVolume(id, siteId, req);
  }
}
