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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type {
  NovelCard,
  NovelDetail,
  NovelVolume,
  Paginated,
  TxtImportResult,
} from '@wmcms/shared';
import { CurrentSiteId, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthContext, AuthenticatedRequest, FileUpload } from '../../common/types';
import { ChaptersService } from './chapters.service';
import { BatchNovelDto, NOVEL_BATCH_ACTIONS } from './dto/batch-novel.dto';
import { CreateNovelDto } from './dto/create-novel.dto';
import { CreateVolumeDto } from './dto/create-volume.dto';
import { ImportTxtDto } from './dto/import-txt.dto';
import { QueryNovelDto } from './dto/query-novel.dto';
import { ReviewNovelDto } from './dto/review-novel.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { NovelsService } from './novels.service';

/** TXT 小说文件一般远小于媒体文件，这里放宽到 20MB */
const TXT_MAX_BYTES = 20 * 1024 * 1024;

type BatchAction = (typeof NOVEL_BATCH_ACTIONS)[number];

const BATCH_PERMISSIONS: Record<BatchAction, string> = {
  publish: 'novel:review',
  offline: 'novel:review',
  recommend: 'novel:update',
  unrecommend: 'novel:update',
  delete: 'novel:delete',
};

@ApiTags('书籍管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('novels')
export class NovelsController {
  constructor(
    private readonly novels: NovelsService,
    private readonly chapters: ChaptersService,
  ) {}

  @Get()
  @RequirePermissions('novel:view')
  @ApiOperation({ summary: '书籍列表（分页，含分类与最新章节）' })
  list(
    @Query() query: QueryNovelDto,
    @CurrentSiteId() siteId: string,
  ): Promise<Paginated<NovelCard>> {
    return this.novels.list(query, siteId);
  }

  @Post('batch')
  @RequireAnyPermission('novel:review', 'novel:update', 'novel:delete')
  @ApiOperation({ summary: '批量操作书籍（上架/下架/推荐/取消推荐/删除）' })
  async batch(
    @Body() dto: BatchNovelDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthContext,
  ): Promise<{ affected: number }> {
    const required = BATCH_PERMISSIONS[dto.action];
    if (required && !user.isSuperAdmin && !user.permissionCodes.has(required)) {
      throw new ForbiddenException(`缺少权限：${required}`);
    }
    return this.novels.batch(dto, siteId, req);
  }

  @Post(':id/import-txt')
  @RequirePermissions('chapter:create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TXT_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'TXT 文件（≤20MB，自动识别 UTF-8/GBK）' },
        volumeTitle: { type: 'string', description: '导入到指定分卷标题（缺省不分卷）' },
        pattern: { type: 'string', description: '分章正则，缺省 ^第[一二三四五六七八九十百千0-9]+[章节回]' },
      },
    },
  })
  @ApiOperation({ summary: 'TXT 导入章节（自动识别编码、按正则分章、正文转纯文本）' })
  importTxt(
    @Param('id') id: string,
    @UploadedFile() file: FileUpload | undefined,
    @Body() dto: ImportTxtDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<TxtImportResult> {
    return this.chapters.importTxt(id, file, dto, siteId, req);
  }

  @Get(':id/volumes')
  @RequirePermissions('novel:view')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiOperation({ summary: '分卷列表（含各卷章节）' })
  listVolumes(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
  ): Promise<NovelVolume[]> {
    return this.novels.listVolumes(id, siteId);
  }

  @Post(':id/volumes')
  @RequirePermissions('novel:update')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiOperation({ summary: '新建分卷（sort 缺省取 max+1）' })
  createVolume(
    @Param('id') id: string,
    @Body() dto: CreateVolumeDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NovelVolume> {
    return this.novels.createVolume(id, dto, siteId, req);
  }

  @Post(':id/review')
  @RequirePermissions('novel:review')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiOperation({ summary: '书籍审核/上下架（published / rejected / offline）' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewNovelDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NovelCard> {
    return this.novels.review(id, dto, siteId, req);
  }

  @Get(':id')
  @RequirePermissions('novel:view')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiOperation({ summary: '书籍详情（含全部分卷/章节与统计）' })
  findOne(@Param('id') id: string, @CurrentSiteId() siteId: string): Promise<NovelDetail> {
    return this.novels.findOne(id, siteId);
  }

  @Post()
  @RequirePermissions('novel:create')
  @ApiOperation({ summary: '新建书籍（slug 同站点唯一，触发 novel.beforeCreate 插件钩子）' })
  create(
    @Body() dto: CreateNovelDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NovelCard> {
    return this.novels.create(dto, siteId, req);
  }

  @Patch(':id')
  @RequirePermissions('novel:update')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiOperation({ summary: '更新书籍信息' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNovelDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NovelCard> {
    return this.novels.update(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('novel:delete')
  @ApiParam({ name: 'id', description: '书籍 ID' })
  @ApiOperation({ summary: '删除书籍（级联删除章节/书评/书架/进度）' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.novels.remove(id, siteId, req);
  }
}
