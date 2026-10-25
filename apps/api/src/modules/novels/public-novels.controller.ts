import { Controller, Get, Header, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  ChapterContent,
  NovelCard,
  NovelCatalog,
  NovelDetail,
  Paginated,
  PublicCategory,
} from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { OptionalMemberAuthGuard } from '../../common/guards/member-auth.guard';
import type { AuthenticatedRequest } from '../../common/types';
import { CategoriesService } from '../categories/categories.service';
import { ChaptersService } from './chapters.service';
import { PublicNovelQueryDto } from './dto/public-novel-query.dto';
import { PublicRankingQueryDto } from './dto/public-ranking-query.dto';
import { PublicNovelSearchQueryDto } from './dto/public-search-query.dto';
import { ReadChapterQueryDto } from './dto/read-chapter-query.dto';
import { NovelsService } from './novels.service';

/** 门户公开接口：小说分类 / 书库 / 详情 / 目录 / 阅读 / 排行 / 搜索 */
@ApiTags('门户-小说')
@Public()
@Controller('public/sites/:siteSlug')
export class PublicNovelsController {
  constructor(
    private readonly novels: NovelsService,
    private readonly chapters: ChaptersService,
    private readonly categories: CategoriesService,
  ) {}

  @Get('novel-categories')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiOperation({ summary: '小说分类树（仅启用中的 type=novel 栏目）' })
  novelCategories(@Param('siteSlug') siteSlug: string): Promise<PublicCategory[]> {
    return this.categories.publicTree(siteSlug, 'novel');
  }

  @Get('novels')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiOperation({ summary: '书库列表（仅上架书籍，支持分类/状态/关键词/排序）' })
  list(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicNovelQueryDto,
  ): Promise<Paginated<NovelCard>> {
    return this.novels.publicList(siteSlug, query);
  }

  @Get('novels/:novelSlug/catalog')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiParam({ name: 'novelSlug', description: '书籍 slug', example: 'xinghai-bian' })
  @ApiOperation({ summary: '书籍完整目录（分卷 + 已发布章节）' })
  catalog(
    @Param('siteSlug') siteSlug: string,
    @Param('novelSlug') novelSlug: string,
  ): Promise<NovelCatalog> {
    return this.novels.publicCatalog(siteSlug, novelSlug);
  }

  @Get('novels/:novelSlug/chapters/:chapterNo')
  @UseGuards(OptionalMemberAuthGuard)
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiParam({ name: 'novelSlug', description: '书籍 slug', example: 'xinghai-bian' })
  @ApiParam({ name: 'chapterNo', description: '章节序号', example: 1 })
  @ApiOperation({
    summary: '章节阅读：VIP 未解锁返回 locked+preview（content 为空），已解锁返回完整正文与余额',
  })
  chapter(
    @Param('siteSlug') siteSlug: string,
    @Param('novelSlug') novelSlug: string,
    @Param('chapterNo') chapterNo: string,
    @Query() query: ReadChapterQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChapterContent> {
    return this.chapters.publicChapter(
      siteSlug,
      novelSlug,
      chapterNo,
      req.member?.id,
      query.percent,
    );
  }

  @Get('novels/:novelSlug')
  @UseGuards(OptionalMemberAuthGuard)
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiParam({ name: 'novelSlug', description: '书籍 slug', example: 'xinghai-bian' })
  @ApiOperation({
    summary: '书籍详情（含分卷目录/首章/最新章节/评论数；携带会员 token 时返回书架/进度/已解锁）',
  })
  detail(
    @Param('siteSlug') siteSlug: string,
    @Param('novelSlug') novelSlug: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NovelDetail> {
    return this.novels.publicDetail(siteSlug, novelSlug, req.member?.id);
  }

  @Get('rankings')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiOperation({ summary: '排行榜（hot 热门 / new 新书 / favorite 收藏 / words 字数）' })
  rankings(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicRankingQueryDto,
  ): Promise<NovelCard[]> {
    return this.novels.rankings(siteSlug, query);
  }

  @Get('search')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiOperation({ summary: '搜索书名/作者/简介' })
  search(
    @Param('siteSlug') siteSlug: string,
    @Query() query: PublicNovelSearchQueryDto,
  ): Promise<Paginated<NovelCard>> {
    return this.novels.search(siteSlug, query);
  }

  @Get('sitemap.xml')
  @RawResponse()
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiOperation({ summary: '站点 sitemap.xml（书籍/章节/分类/排行/作者，含插件追加 URL）' })
  sitemap(@Param('siteSlug') siteSlug: string): Promise<string> {
    return this.novels.sitemapXml(siteSlug);
  }

  @Get('rss.xml')
  @RawResponse()
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  @ApiParam({ name: 'siteSlug', description: '站点标识', example: 'books' })
  @ApiOperation({ summary: '最新章节 RSS 2.0（最近 20 章）' })
  rss(@Param('siteSlug') siteSlug: string): Promise<string> {
    return this.novels.rssXml(siteSlug);
  }
}
