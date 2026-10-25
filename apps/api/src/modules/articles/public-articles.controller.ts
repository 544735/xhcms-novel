import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  Paginated,
  PublicArchiveGroup,
  PublicArticleCard,
  PublicArticleDetail,
  Tag,
} from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { ArticlesService } from './articles.service';
import { PublicArticleQueryDto } from './dto/public-article-query.dto';
import { PublicSearchQueryDto } from './dto/public-search-query.dto';

/** 门户公开接口：文章列表 / 详情 / 标签 / 归档 / 搜索 / sitemap / rss */
@ApiTags('门户-文章')
@Public()
@Controller('public/sites/:siteSlug')
export class PublicArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get('articles')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '公开文章列表（分页）' })
  list(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicArticleQueryDto,
  ): Promise<Paginated<PublicArticleCard>> {
    return this.articles.publicList(siteSlug, query);
  }

  @Get('articles/:slug')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiParam({ name: 'slug', description: '文章 slug', example: 'nextjs-15-rebuild-website' })
  @ApiOperation({ summary: '公开文章详情（正文清洗 + 插件渲染增强 + 浏览量自增）' })
  detail(
    @Param('siteSlug') siteSlug: string,
    @Param('slug') slug: string,
  ): Promise<PublicArticleDetail> {
    return this.articles.publicDetail(siteSlug, slug);
  }

  @Get('tags')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '公开标签列表（含文章数）' })
  tags(@Param('siteSlug') siteSlug: string): Promise<Tag[]> {
    return this.articles.publicTags(siteSlug);
  }

  @Get('archive')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '公开归档（按年月分组统计）' })
  archive(@Param('siteSlug') siteSlug: string): Promise<PublicArchiveGroup[]> {
    return this.articles.publicArchive(siteSlug);
  }

  @Get('search')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '站内搜索（标题/摘要/正文）' })
  search(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicSearchQueryDto,
  ): Promise<Paginated<PublicArticleCard>> {
    return this.articles.publicSearch(siteSlug, query);
  }

  @Get('sitemap.xml')
  @RawResponse()
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '站点 sitemap.xml（含插件追加的栏目页/标签页 URL）' })
  sitemap(@Param('siteSlug') siteSlug: string): Promise<string> {
    return this.articles.sitemapXml(siteSlug);
  }

  @Get('rss.xml')
  @RawResponse()
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'tech' })
  @ApiOperation({ summary: '站点 rss.xml（最近 20 篇文章）' })
  rss(@Param('siteSlug') siteSlug: string): Promise<string> {
    return this.articles.rssXml(siteSlug);
  }
}
