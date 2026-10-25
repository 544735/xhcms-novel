import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { PublicCategoriesController } from './public-categories.controller';

@Module({
  imports: [SitesModule],
  controllers: [CategoriesController, PublicCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
