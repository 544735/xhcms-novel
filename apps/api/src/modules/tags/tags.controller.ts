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
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Paginated, Tag } from '@wmcms/shared';
import { CurrentSiteId } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { CreateTagDto } from './dto/create-tag.dto';
import { QueryTagDto } from './dto/query-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagsService } from './tags.service';

@ApiTags('标签管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @RequirePermissions('tag:view')
  @ApiOperation({ summary: '标签列表（分页）' })
  list(@Query() query: QueryTagDto, @CurrentSiteId() siteId: string): Promise<Paginated<Tag>> {
    return this.tags.list(query, siteId);
  }

  @Get('options')
  @RequirePermissions('tag:view')
  @ApiOperation({ summary: '标签下拉选项（当前站点全部）' })
  options(@CurrentSiteId() siteId: string): Promise<Tag[]> {
    return this.tags.options(siteId);
  }

  @Post()
  @RequirePermissions('tag:create')
  @ApiOperation({ summary: '新建标签' })
  create(
    @Body() dto: CreateTagDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Tag> {
    return this.tags.create(dto, siteId, req);
  }

  @Patch(':id')
  @RequirePermissions('tag:update')
  @ApiOperation({ summary: '更新标签' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Tag> {
    return this.tags.update(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('tag:delete')
  @ApiOperation({ summary: '删除标签' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.tags.remove(id, siteId, req);
  }
}
