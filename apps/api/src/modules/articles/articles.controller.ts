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
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Article, ArticleBatchAction, ArticleListItem, Paginated } from '@wmcms/shared';
import { CurrentSiteId, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { ArticlesService } from './articles.service';
import { BatchArticleDto } from './dto/batch-article.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const BATCH_PERMISSIONS: Record<ArticleBatchAction, string> = {
  publish: 'article:publish',
  unpublish: 'article:publish',
  archive: 'article:publish',
  delete: 'article:delete',
  top: 'article:update',
  untop: 'article:update',
  recommend: 'article:update',
  unrecommend: 'article:update',
};

@ApiTags('文章管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @RequirePermissions('article:view')
  @ApiOperation({ summary: '文章列表（分页，不含正文）' })
  list(
    @Query() query: QueryArticleDto,
    @CurrentSiteId() siteId: string,
  ): Promise<Paginated<ArticleListItem>> {
    return this.articles.list(query, siteId);
  }

  @Post('batch')
  @RequireAnyPermission('article:update', 'article:publish', 'article:delete')
  @ApiOperation({ summary: '批量操作文章（发布/撤回/归档/删除/置顶/推荐）' })
  batch(
    @Body() dto: BatchArticleDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthContext,
  ): Promise<{ affected: number }> {
    const required = BATCH_PERMISSIONS[dto.action];
    if (required && !user.isSuperAdmin && !user.permissionCodes.has(required)) {
      throw new ForbiddenException(`缺少权限：${required}`);
    }
    return this.articles.batch(dto, siteId, req);
  }

  @Get(':id')
  @RequirePermissions('article:view')
  @ApiOperation({ summary: '文章详情（含正文）' })
  findOne(@Param('id') id: string, @CurrentSiteId() siteId: string): Promise<Article> {
    return this.articles.findOne(id, siteId);
  }

  @Post()
  @RequirePermissions('article:create')
  @ApiOperation({ summary: '新建文章（tagIds 全量设置，slug 同站点唯一）' })
  create(
    @Body() dto: CreateArticleDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthContext,
  ): Promise<Article> {
    return this.articles.create(dto, siteId, req, user);
  }

  @Patch(':id')
  @RequirePermissions('article:update')
  @ApiOperation({ summary: '更新文章（tagIds 传值即全量替换）' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Article> {
    return this.articles.update(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('article:delete')
  @ApiOperation({ summary: '删除文章' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.articles.remove(id, siteId, req);
  }

  @Post(':id/publish')
  @RequirePermissions('article:publish')
  @ApiOperation({ summary: '发布文章' })
  publish(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Article> {
    return this.articles.publish(id, siteId, req);
  }

  @Post(':id/unpublish')
  @RequirePermissions('article:publish')
  @ApiOperation({ summary: '撤回文章（转为草稿，保留发布时间）' })
  unpublish(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Article> {
    return this.articles.unpublish(id, siteId, req);
  }
}
