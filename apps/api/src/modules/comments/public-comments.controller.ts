import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Comment, PublicComment } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { Req } from '../../common/decorators/current-user.decorator';
import { OptionalMemberAuthGuard } from '../../common/guards/member-auth.guard';
import type { AuthenticatedRequest } from '../../common/types';
import { CommentsService } from './comments.service';
import { CreatePublicCommentDto } from './dto/comment-ops.dto';

@ApiTags('门户-评论')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@ApiParam({ name: 'articleSlug', description: '文章 slug' })
@Controller('public/sites/:siteSlug/articles/:articleSlug/comments')
export class PublicCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @ApiOperation({ summary: '文章评论树（仅已通过审核）' })
  tree(
    @Param('siteSlug') siteSlug: string,
    @Param('articleSlug') articleSlug: string,
  ): Promise<PublicComment[]> {
    return this.comments.publicTree(siteSlug, articleSlug);
  }

  @Post()
  @UseGuards(OptionalMemberAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: '提交评论（匿名可用；携带会员 token 时绑定会员身份，20 次/分钟）',
    description:
      '评论内容先经 sanitize 清洗，再由 comment.beforeCreate 插件钩子拦截违规内容；' +
      '同 IP 60 秒内重复内容返回 429；审核开关取自站点 settings.commentAudit（默认开启）。',
  })
  create(
    @Param('siteSlug') siteSlug: string,
    @Param('articleSlug') articleSlug: string,
    @Body() dto: CreatePublicCommentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Comment> {
    return this.comments.createPublic(siteSlug, articleSlug, dto, req);
  }
}
