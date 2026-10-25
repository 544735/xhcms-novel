import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { PublicThemeController } from './public-theme.controller';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';

@Module({
  imports: [SitesModule],
  controllers: [ThemesController, PublicThemeController],
  providers: [ThemesService],
  exports: [ThemesService],
})
export class ThemesModule {}
