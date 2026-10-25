import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BookSource } from '@wmcms/shared';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { BookSourcesService, type BookSourceTestResult } from './book-sources.service';
import { CreateBookSourceDto } from './dto/create-book-source.dto';
import { TestBookSourceDto } from './dto/test-book-source.dto';
import { UpdateBookSourceDto } from './dto/update-book-source.dto';

@ApiTags('采集-书源')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('book-sources')
export class BookSourcesController {
  constructor(private readonly bookSources: BookSourcesService) {}

  @Get()
  @RequirePermissions('collect:view')
  @ApiOperation({ summary: '书源列表（当前站点全部，selectors 已解析为对象）' })
  list(@CurrentSiteId() siteId: string): Promise<BookSource[]> {
    return this.bookSources.list(siteId);
  }

  @Get(':id')
  @RequirePermissions('collect:view')
  @ApiOperation({ summary: '书源详情' })
  findOne(@Param('id') id: string, @CurrentSiteId() siteId: string): Promise<BookSource> {
    return this.bookSources.findOne(id, siteId);
  }

  @Post()
  @RequirePermissions('collect:create')
  @ApiOperation({ summary: '新建书源' })
  create(
    @Body() dto: CreateBookSourceDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<BookSource> {
    return this.bookSources.create(dto, siteId, req);
  }

  @Patch(':id')
  @RequirePermissions('collect:update')
  @ApiOperation({ summary: '更新书源' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookSourceDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<BookSource> {
    return this.bookSources.update(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('collect:delete')
  @ApiOperation({ summary: '删除书源（历史任务保留，sourceId 置空）' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.bookSources.remove(id, siteId, req);
  }

  @Post(':id/test')
  @RequirePermissions('collect:run')
  @ApiOperation({
    summary: '试采集：抓取书籍页（缺省 baseUrl），返回书籍信息与最多 5 条章节标题，不落库',
  })
  test(
    @Param('id') id: string,
    @Body() dto: TestBookSourceDto,
    @CurrentSiteId() siteId: string,
  ): Promise<BookSourceTestResult> {
    return this.bookSources.test(id, dto, siteId);
  }
}
