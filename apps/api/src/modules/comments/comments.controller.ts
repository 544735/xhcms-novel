import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Comment, Paginated } from '@wmcms/shared';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, CurrentUser, Req } from '../../common/decorators/current-user.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { CommentsService } from './comments.service';
import { QueryCommentDto } from './dto/query-comment.dto';
import { BatchCommentsDto, UpdateCommentStatusDto } from './dto/comment-ops.dto';

/** 批量动作 → 所需权限（delete 必须单独持有 comment:delete，不能靠 comment:update 越权） */
const BATCH_PERMISSIONS: Record<BatchCommentsDto['action'], string> = {
  approve: 'comment:update',
  reject: 'comment:update',
  delete: 'comment:delete',
};

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
  @RequireAnyPermission('comment:update', 'comment:delete')
  @ApiOperation({ summary: '批量审核 / 删除评论（delete 需 comment:delete 权限）' })
  batch(
    @CurrentSiteId() siteId: string,
    @Body() dto: BatchCommentsDto,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthContext,
  ): Promise<{ affected: number }> {
    // 入口守卫只能保证「拥有其中之一」，这里按具体动作再收敛一次
    const required = BATCH_PERMISSIONS[dto.action];
    if (required && !user.isSuperAdmin && !user.permissionCodes.has(required)) {
      throw new ForbiddenException(`缺少权限：${required}`);
    }
    return this.comments.batch(siteId, dto, req);
  }
}
