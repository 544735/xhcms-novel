import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import {
  AdminNovelComment,
  NovelCommentsService,
} from './novel-comments.service';
import {
  QueryNovelCommentDto,
  UpdateNovelCommentStatusDto,
} from './dto/novel-comment.dto';

@ApiTags('书评章评管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('novel-comments')
export class NovelCommentsController {
  constructor(private readonly comments: NovelCommentsService) {}

  @Get()
  @RequirePermissions('comment:view')
  @ApiOperation({ summary: '书评/章评列表（分页 + 状态 + 书籍/章节 + 关键字）' })
  list(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryNovelCommentDto,
  ): Promise<Paginated<AdminNovelComment>> {
    return this.comments.list(siteId, query);
  }

  @Patch(':id/status')
  @RequirePermissions('comment:update')
  @ApiOperation({ summary: '审核书评/章评（approved / rejected）' })
  setStatus(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNovelCommentStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminNovelComment> {
    return this.comments.setStatus(siteId, id, dto.status, req);
  }

  @Delete(':id')
  @RequirePermissions('comment:delete')
  @ApiOperation({ summary: '删除书评/章评（子回复级联删除）' })
  remove(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.comments.remove(siteId, id, req);
  }
}
