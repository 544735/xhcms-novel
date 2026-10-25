import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

/**
 * 旧文章内容模块（管理端保留，仅用于历史数据/兼容）。
 * 注意：小说站已由 modules/novels 提供门户 /public/** 内容接口，
 * 旧的 PublicArticlesController 已注销，避免与小说路由冲突。
 */
@Module({
  imports: [SitesModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
