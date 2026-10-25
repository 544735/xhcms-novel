import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  ApiTags,
} from '@nestjs/swagger';
import { UPLOAD_MAX_BYTES } from '@wmcms/shared';
import type { Media, Paginated } from '@wmcms/shared';
import { CurrentSiteId, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthContext, AuthenticatedRequest, FileUpload } from '../../common/types';
import { BatchDeleteMediaDto } from './dto/batch-delete-media.dto';
import { QueryMediaDto } from './dto/query-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { MediaService } from './media.service';

@ApiTags('媒体库')
@ApiBearerAuth('admin')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @SiteScoped()
  @RequirePermissions('media:view')
  @ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
  @ApiOperation({ summary: '媒体列表（分页，可按 mimeType/folder 过滤）' })
  list(
    @Query() query: QueryMediaDto,
    @CurrentSiteId() siteId: string,
  ): Promise<Paginated<Media>> {
    return this.media.list(query, siteId);
  }

  @Post('upload')
  @RequirePermissions('media:upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'siteId'],
      properties: {
        file: { type: 'string', format: 'binary', description: '文件（≤10MB）' },
        siteId: { type: 'string', description: '站点 ID' },
        folder: { type: 'string', description: '自定义文件夹（缺省 yyyyMM）' },
      },
    },
  })
  @ApiOperation({
    summary: '上传媒体（multipart：file 必填、siteId 必填），落盘 uploads/<siteId>/<yyyyMM>/<uuid>.<ext>',
  })
  upload(
    @UploadedFile() file: FileUpload | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: AuthContext,
    @Req() req: AuthenticatedRequest,
  ): Promise<Media> {
    return this.media.upload(file, dto, user, req);
  }

  @Post('batch-delete')
  @SiteScoped()
  @RequirePermissions('media:delete')
  @ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
  @ApiOperation({ summary: '批量删除媒体（同时删除磁盘文件）' })
  batchDelete(
    @Body() dto: BatchDeleteMediaDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ affected: number }> {
    return this.media.batchRemove(dto, siteId, req);
  }

  @Delete(':id')
  @SiteScoped()
  @RequirePermissions('media:delete')
  @ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
  @ApiOperation({ summary: '删除媒体（同时删除磁盘文件）' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.media.remove(id, siteId, req);
  }
}
