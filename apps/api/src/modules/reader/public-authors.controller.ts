import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthorStats, NovelCard } from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { AuthorsService } from './authors.service';

@ApiTags('门户-作者页')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@ApiParam({ name: 'penName', description: '作者笔名' })
@Controller('public/sites/:siteSlug/authors')
export class PublicAuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get(':penName')
  @ApiOperation({ summary: '作者主页（笔名/简介/统计/已上架作品）' })
  author(
    @Param('siteSlug') siteSlug: string,
    @Param('penName') penName: string,
  ): Promise<{
    penName: string;
    bio: string | null;
    stats: AuthorStats;
    novels: NovelCard[];
  }> {
    return this.authors.publicAuthorPage(siteSlug, penName);
  }
}
