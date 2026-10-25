import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { SitesModule } from '../sites/sites.module';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { NovelsController } from './novels.controller';
import { NovelsService } from './novels.service';
import { PublicNovelsController } from './public-novels.controller';
import { VolumesController } from './volumes.controller';

@Module({
  imports: [SitesModule, CategoriesModule],
  controllers: [
    NovelsController,
    VolumesController,
    ChaptersController,
    PublicNovelsController,
  ],
  providers: [NovelsService, ChaptersService],
  exports: [NovelsService, ChaptersService],
})
export class NovelsModule {}
