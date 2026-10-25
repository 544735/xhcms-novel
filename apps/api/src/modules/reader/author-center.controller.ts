import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  AuthorNovelItem,
  AuthorProfile,
  AuthorStats,
  ChapterSummary,
  NovelCard,
  Paginated,
} from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentMember } from '../../common/decorators/current-user.decorator';
import { MemberAuthGuard } from '../../common/guards/member-auth.guard';
import type { AuthMember } from '../../common/types';
import { AuthorsService, type AuthorChapterDetail } from './authors.service';
import {
  ApplyAuthorDto,
  CreateAuthorChapterDto,
  CreateAuthorNovelDto,
  QueryAuthorChapterDto,
  QueryAuthorNovelDto,
  UpdateAuthorChapterDto,
  UpdateAuthorNovelDto,
} from './dto/author.dto';

@ApiTags('门户-作者中心')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@Controller('public/sites/:siteSlug/members/author')
export class AuthorCenterController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '我的作者资料（未申请返回 null）' })
  profile(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
  ): Promise<AuthorProfile | null> {
    return this.authors.getProfile(siteSlug, member.id);
  }

  @Post()
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '申请成为作者（重复申请 409）' })
  apply(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: ApplyAuthorDto,
  ): Promise<AuthorProfile> {
    return this.authors.apply(siteSlug, member.id, dto);
  }

  @Get('stats')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '作者数据（作品数/章节数/字数/人气/收藏/今日阅读）' })
  stats(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
  ): Promise<AuthorStats> {
    return this.authors.stats(siteSlug, member.id);
  }

  @Get('novels')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '我的作品列表（含待发布章节数）' })
  listNovels(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Query() query: QueryAuthorNovelDto,
  ): Promise<Paginated<AuthorNovelItem>> {
    return this.authors.listNovels(siteSlug, member.id, query);
  }

  @Post('novels')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '新建作品（须 approved 作者；auditStatus=pending）' })
  createNovel(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: CreateAuthorNovelDto,
  ): Promise<NovelCard> {
    return this.authors.createNovel(siteSlug, member.id, dto);
  }

  @Patch('novels/:id')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '编辑本人作品（不改变审核状态）' })
  updateNovel(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: UpdateAuthorNovelDto,
  ): Promise<NovelCard> {
    return this.authors.updateNovel(siteSlug, member.id, id, dto);
  }

  @Delete('novels/:id')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '删除本人作品（级联删除章节/评论/书架等）' })
  deleteNovel(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @CurrentMember() member: AuthMember,
  ): Promise<null> {
    return this.authors.deleteNovel(siteSlug, member.id, id);
  }

  @Get('novels/:id/chapters')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '本人作品章节列表（按章节号升序）' })
  listChapters(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @CurrentMember() member: AuthMember,
    @Query() query: QueryAuthorChapterDto,
  ): Promise<Paginated<ChapterSummary>> {
    return this.authors.listChapters(siteSlug, member.id, id, query);
  }

  @Post('novels/:id/chapters')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '新建章节（自动重算字数/章节数；书籍未上架则为草稿）' })
  createChapter(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: CreateAuthorChapterDto,
  ): Promise<ChapterSummary> {
    return this.authors.createChapter(siteSlug, member.id, id, dto);
  }

  @Get('novels/:id/chapters/:chapterId')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({
    summary: '章节详情（含完整正文，仅限本人作品；作者编辑不受 VIP 锁定影响）',
  })
  getChapter(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentMember() member: AuthMember,
  ): Promise<AuthorChapterDetail> {
    return this.authors.getChapter(siteSlug, member.id, id, chapterId);
  }

  @Patch('novels/:id/chapters/:chapterId')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '编辑章节（仅限本人作品；重算字数/章节数）' })
  updateChapter(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: UpdateAuthorChapterDto,
  ): Promise<ChapterSummary> {
    return this.authors.updateChapter(siteSlug, member.id, id, chapterId, dto);
  }

  @Delete('novels/:id/chapters/:chapterId')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '删除章节（仅限本人作品；重算字数/章节数）' })
  deleteChapter(
    @Param('siteSlug') siteSlug: string,
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentMember() member: AuthMember,
  ): Promise<null> {
    return this.authors.deleteChapter(siteSlug, member.id, id, chapterId);
  }
}
