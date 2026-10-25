import { Module } from '@nestjs/common';
import { PublicSitesController } from './public-sites.controller';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  controllers: [SitesController, PublicSitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
