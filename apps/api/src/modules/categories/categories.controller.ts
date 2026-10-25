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
import type { Category, CategoryNode } from '@wmcms/shared';
import {
  CurrentSiteId,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('栏目管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '站点上下文 ID' })
@SiteScoped()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermissions('category:view')
  @ApiOperation({ summary: '栏目列表（扁平，含文章数）' })
  list(
    @Query() query: QueryCategoryDto,
    @CurrentSiteId() siteId: string,
  ): Promise<Category[]> {
    return this.categories.list(query, siteId);
  }

  @Get('tree')
  @RequirePermissions('category:view')
  @ApiOperation({ summary: '栏目树（嵌套）' })
  tree(@CurrentSiteId() siteId: string): Promise<CategoryNode[]> {
    return this.categories.tree(siteId);
  }

  @Get(':id')
  @RequirePermissions('category:view')
  @ApiOperation({ summary: '栏目详情' })
  findOne(@Param('id') id: string, @CurrentSiteId() siteId: string): Promise<Category> {
    return this.categories.findOne(id, siteId);
  }

  @Post()
  @RequirePermissions('category:create')
  @ApiOperation({ summary: '新建栏目' })
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Category> {
    return this.categories.create(dto, siteId, req);
  }

  @Patch(':id')
  @RequirePermissions('category:update')
  @ApiOperation({ summary: '更新栏目' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<Category> {
    return this.categories.update(id, dto, siteId, req);
  }

  @Delete(':id')
  @RequirePermissions('category:delete')
  @ApiOperation({ summary: '删除栏目（存在子栏目或文章时拒绝）' })
  remove(
    @Param('id') id: string,
    @CurrentSiteId() siteId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<null> {
    return this.categories.remove(id, siteId, req);
  }
}
