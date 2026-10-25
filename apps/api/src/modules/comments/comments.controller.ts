import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Comment, Paginated } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { CommentsService } from './comments.service';
import { QueryCommentDto } from './dto/query-comment.dto';
import { BatchCommentsDto, UpdateCommentStatusDto } from './dto/comment-ops.dto';

@ApiTags('评论管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @RequirePermissions('comment:view')
  @ApiOperation({ summary: '评论列表（分页 + 状态 + 文章 + 关键字）' })
  list(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryCommentDto,
  ): Promise<Paginated<Comment>> {
    return this.comments.list(siteId, query);
  }

  @Patch(':id/status')
  @RequirePermissions('comment:update')
  @ApiOperation({ summary: '审核评论（approved / rejected）' })
  setStatus(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommentStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Comment> {
    return this.comments.setStatus(siteId, id, dto.status, req);
  }

  @Delete(':id')
  @RequirePermissions('comment:delete')
  @ApiOperation({ summary: '删除评论（含子回复）' })
  remove(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.comments.remove(siteId, id, req);
  }

  @Post('batch')
  @RequirePermissions('comment:update')
  @ApiOperation({ summary: '批量审核 / 删除评论' })
  batch(
    @CurrentSiteId() siteId: string,
    @Body() dto: BatchCommentsDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ affected: number }> {
    return this.comments.batch(siteId, dto, req);
  }
}
