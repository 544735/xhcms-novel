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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, Site, SiteSummary } from '@wmcms/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthContext, AuthenticatedRequest } from '../../common/types';
import { CreateSiteDto } from './dto/create-site.dto';
import { QuerySiteDto } from './dto/query-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

@ApiTags('站点管理')
@ApiBearerAuth('admin')
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @RequirePermissions('site:view')
  @ApiOperation({ summary: '站点列表（分页）' })
  list(@Query() query: QuerySiteDto, @CurrentUser() user: AuthContext): Promise<Paginated<Site>> {
    return this.sites.list(query, user);
  }

  @Get('options')
  @ApiOperation({ summary: '当前用户可访问的站点下拉选项' })
  options(@CurrentUser() user: AuthContext): Promise<SiteSummary[]> {
    return this.sites.options(user);
  }

  @Get(':id')
  @RequirePermissions('site:view')
  @ApiOperation({ summary: '站点详情' })
  findOne(@Param('id') id: string): Promise<Site> {
    return this.sites.findOne(id);
  }

  @Post()
  @RequirePermissions('site:create')
  @ApiOperation({ summary: '新建站点' })
  create(@Body() dto: CreateSiteDto, @Req() req: AuthenticatedRequest): Promise<Site> {
    return this.sites.create(dto, req);
  }

  @Patch(':id')
  @RequirePermissions('site:update')
  @ApiOperation({ summary: '更新站点' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<Site> {
    return this.sites.update(id, dto, req);
  }

  @Delete(':id')
  @RequirePermissions('site:delete')
  @ApiOperation({ summary: '删除站点（存在文章时拒绝）' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<null> {
    return this.sites.remove(id, req);
  }
}
