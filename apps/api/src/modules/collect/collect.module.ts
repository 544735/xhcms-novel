import { Module } from '@nestjs/common';
import { BookSourcesController } from './book-sources.controller';
import { BookSourcesService } from './book-sources.service';
import { CollectController } from './collect.controller';
import { CollectService } from './collect.service';
import { PublicCollectDemoController } from './public-demo.controller';

@Module({
  controllers: [BookSourcesController, CollectController, PublicCollectDemoController],
  providers: [BookSourcesService, CollectService],
  exports: [BookSourcesService, CollectService],
})
export class CollectModule {}
