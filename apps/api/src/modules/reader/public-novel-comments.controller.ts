import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PublicNovelComment } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { Req } from '../../common/decorators/current-user.decorator';
import { OptionalMemberAuthGuard } from '../../common/guards/member-auth.guard';
import type { AuthenticatedRequest } from '../../common/types';
import { NovelCommentsService } from './novel-comments.service';
import {
  CreateNovelCommentDto,
  PublicNovelCommentQueryDto,
} from './dto/novel-comment.dto';

@ApiTags('门户-书评章评')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@Controller('public/sites/:siteSlug/novel-comments')
export class PublicNovelCommentsController {
  constructor(private readonly comments: NovelCommentsService) {}

  @Get()
  @ApiOperation({ summary: '书评/章评树（仅已通过审核；根评论分页，回复随根返回）' })
  tree(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicNovelCommentQueryDto,
  ): Promise<PublicNovelComment[]> {
    return this.comments.publicTree(siteSlug, query);
  }

  @Post()
  @UseGuards(OptionalMemberAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: '发表书评/章评（匿名或会员，20 次/分钟）',
    description:
      '内容先经 sanitize 清洗，再由 comment.beforeCreate 插件钩子拦截违规内容；' +
      '是否进入审核队列取决于站点 settings.commentAudit（默认开启）。',
  })
  create(
    @Param('siteSlug') siteSlug: string,
    @Body() dto: CreateNovelCommentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ id: string; status: string }> {
    return this.comments.createPublic(siteSlug, dto, req);
  }
}
