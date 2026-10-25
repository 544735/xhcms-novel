import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { PublicCategory, PublicPage } from '@wmcms/shared';
import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

class PublicCategoryQueryDto {
  @ApiPropertyOptional({ description: '栏目类型过滤', enum: ['article', 'page', 'novel'] })
  @IsOptional()
  @IsIn(['article', 'page', 'novel'], { message: '栏目类型只能为 article、page 或 novel' })
  type?: 'article' | 'page' | 'novel';
}

/** 门户公开接口：栏目树与单页 */
@ApiTags('门户-栏目')
@Public()
@Controller('public/sites/:siteSlug')
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '公开栏目树（仅启用中的栏目）' })
  tree(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicCategoryQueryDto,
  ): Promise<PublicCategory[]> {
    return this.categories.publicTree(siteSlug, query.type);
  }

  @Get('pages/:slug')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiParam({ name: 'slug', description: '单页 slug', example: 'about' })
  @ApiOperation({ summary: '单页详情（page 类型栏目）' })
  page(
    @Param('siteSlug') siteSlug: string,
    @Param('slug') slug: string,
  ): Promise<PublicPage> {
    return this.categories.publicPage(siteSlug, slug);
  }
}
