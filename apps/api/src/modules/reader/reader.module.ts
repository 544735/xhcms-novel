import { Module } from '@nestjs/common';
import { BookshelfService } from './bookshelf.service';
import { NovelCommentsService } from './novel-comments.service';
import { AuthorsService } from './authors.service';
import { PublicReaderController } from './public-reader.controller';
import { PublicNovelCommentsController } from './public-novel-comments.controller';
import { NovelCommentsController } from './novel-comments.controller';
import { AuthorCenterController } from './author-center.controller';
import { PublicAuthorsController } from './public-authors.controller';
import { AuthorApplicationsController } from './author-applications.controller';

/**
 * 阅读互动域：书架/阅读历史/进度、书评章评、作者中心与公开作者页。
 * 会员 token 校验使用内核 MemberAuthGuard / OptionalMemberAuthGuard。
 */
@Module({
  controllers: [
    PublicReaderController,
    PublicNovelCommentsController,
    NovelCommentsController,
    AuthorCenterController,
    PublicAuthorsController,
    AuthorApplicationsController,
  ],
  providers: [BookshelfService, NovelCommentsService, AuthorsService],
  exports: [BookshelfService, NovelCommentsService, AuthorsService],
})
export class ReaderModule {}
