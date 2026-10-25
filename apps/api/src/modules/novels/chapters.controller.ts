import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { ChapterSummary, Paginated } from '@wmcms/shared';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { ChaptersService, type AdminChapterDetail } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { QueryChapterDto } from './dto/query-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

@ApiTags('章节管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chapters: ChaptersService) {}

  @Get()
  @RequirePermissions('chapter:view')
  @ApiOperation({ summary: '章节列表（novelId 必填，分页，不含正文）' })
  list(
    @Query() query: QueryChapterDto,
    @CurrentSiteId() siteId: string,
  ): Promise<Paginated<ChapterSummary>> {
    return this.chapters.list(query, siteId);
  }

  @Get(':id')
  @RequirePermissions('chapter:view')
  @ApiParam({ name: 'id', description: '章节 ID' })
  @ApiOperation({ summary: '章节详情（含完整正文）' })
  findOne(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
  ): Promise<AdminChapterDetail> {
    return this.chapters.findOne(id, siteId);
  }

  @Post()
  @RequirePermissions('chapter:create')
  @ApiOperation({
    summary: '新建章节（chapterNo 自动 max+1；正文转纯文本；重算书籍字数/章节数）',
  })
  create(
    @Body() dto: CreateChapterDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    return this.chapters.create(dto, siteId, req);
  }

  @Post(':id/publish')
  @RequirePermissions('chapter:update')
  @ApiParam({ name: 'id', description: '章节 ID' })
  @ApiOperation({ summary: '发布章节（重算书籍统计，触发 chapter.afterPublish 钩子）' })
  publish(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    return this.chapters.publish(id, siteId, req);
  }

  @Post(':id/unpublish')
  @RequirePermissions('chapter:update')
  @ApiParam({ name: 'id', description: '章节 ID' })
  @ApiOperation({ summary: '撤回章节（转为草稿）' })
  unpublish(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    return this.chapters.unpublish(id, siteId, req);
  }

  @Patch(':id')
  @RequirePermissions('chapter:update')
  @ApiParam({ name: 'id', description: '章节 ID' })
  @ApiOperation({ summary: '更新章节（标题/正文/分卷/VIP 定价/状态/序号）' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateChapterDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminChapterDetail> {
    return this.chapters.update(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('chapter:delete')
  @ApiParam({ name: 'id', description: '章节 ID' })
  @ApiOperation({ summary: '删除章节（重算书籍字数/章节数）' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.chapters.remove(id, siteId, req);
  }
}
