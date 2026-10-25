import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { BookshelfItem, Paginated, ReadingHistoryItem } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentMember } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/pagination.dto';
import { MemberAuthGuard } from '../../common/guards/member-auth.guard';
import type { AuthMember } from '../../common/types';
import { BookshelfService } from './bookshelf.service';
import { NovelCommentsService, type AdminNovelComment } from './novel-comments.service';
import { AddBookshelfDto, HistoryQueryDto, SaveProgressDto } from './dto/reader.dto';

@ApiTags('门户-书架与阅读进度')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@Controller('public/sites/:siteSlug/members')
export class PublicReaderController {
  constructor(
    private readonly bookshelf: BookshelfService,
    private readonly novelComments: NovelCommentsService,
  ) {}

  @Get('bookshelf')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '我的书架（需会员 token；含书籍卡片/最新章节/阅读进度）' })
  shelf(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
  ): Promise<BookshelfItem[]> {
    return this.bookshelf.list(siteSlug, member.id);
  }

  @Post('bookshelf')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '加入书架（幂等）' })
  addShelf(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: AddBookshelfDto,
  ): Promise<{ added: true }> {
    return this.bookshelf.add(siteSlug, member.id, dto);
  }

  @Delete('bookshelf/:novelId')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '移出书架' })
  removeShelf(
    @Param('siteSlug') siteSlug: string,
    @Param('novelId') novelId: string,
    @CurrentMember() member: AuthMember,
  ): Promise<null> {
    return this.bookshelf.remove(siteSlug, member.id, novelId);
  }

  @Get('history')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '阅读历史（按最近阅读时间倒序）' })
  history(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Query() query: HistoryQueryDto,
  ): Promise<Paginated<ReadingHistoryItem>> {
    return this.bookshelf.history(siteSlug, member.id, query);
  }

  @Put('progress')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '保存阅读进度（percent 支持 0-1 或 0-100）' })
  saveProgress(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: SaveProgressDto,
  ): Promise<null> {
    return this.bookshelf.saveProgress(siteSlug, member.id, dto);
  }

  @Get('novel-comments')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({
    summary: '我的书评/章评（含书籍与章节信息，按创建时间倒序）',
    description: '旧 /members/comments 属于文章评论；小说站请使用本接口查看当前会员的书评/章评。',
  })
  myNovelComments(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Query() query: PageQueryDto,
  ): Promise<Paginated<AdminNovelComment>> {
    return this.novelComments.myComments(siteSlug, member.id, query);
  }
}
