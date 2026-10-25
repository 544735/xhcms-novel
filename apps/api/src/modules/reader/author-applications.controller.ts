import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthorProfile, Paginated } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import {
  AdminAuthorApplication,
  AuthorsService,
} from './authors.service';
import {
  QueryAuthorApplicationDto,
  ReviewAuthorApplicationDto,
} from './dto/author.dto';

@ApiTags('作者申请管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('author-applications')
export class AuthorApplicationsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  @RequirePermissions('author:view')
  @ApiOperation({ summary: '作者申请列表（站点内会员，分页 + 状态）' })
  list(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryAuthorApplicationDto,
  ): Promise<Paginated<AdminAuthorApplication>> {
    return this.authors.listApplications(siteId, query);
  }

  @Post(':id/review')
  @RequirePermissions('author:review')
  @ApiOperation({ summary: '审核作者申请（approved / rejected + 驳回原因）' })
  review(
    @CurrentSiteId() siteId: string,
    @Param('id') id: string,
    @Body() dto: ReviewAuthorApplicationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AuthorProfile> {
    return this.authors.reviewApplication(siteId, id, dto, req);
  }
}
