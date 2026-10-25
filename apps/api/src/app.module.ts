import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtConfigModule } from './common/auth/jwt-config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RbacGuard } from './common/guards/rbac.guard';
import { SiteAccessGuard } from './common/guards/site-access.guard';

import { HealthModule } from './health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { SitesModule } from './modules/sites/sites.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { TagsModule } from './modules/tags/tags.module';
import { MediaModule } from './modules/media/media.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ThemesModule } from './modules/themes/themes.module';
import { MembersModule } from './modules/members/members.module';
import { CommentsModule } from './modules/comments/comments.module';
import { FormsModule } from './modules/forms/forms.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NovelsModule } from './modules/novels/novels.module';
import { ReaderModule } from './modules/reader/reader.module';
import { VipModule } from './modules/vip/vip.module';
import { CollectModule } from './modules/collect/collect.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    JwtConfigModule,
    HealthModule,
    // 全局基础模块（审计 / 插件宿主）
    AuditModule,
    PluginsModule,
    // 业务模块
    AuthModule,
    UsersModule,
    RolesModule,
    SitesModule,
    CategoriesModule,
    ArticlesModule,
    TagsModule,
    MediaModule,
    SettingsModule,
    ThemesModule,
    MembersModule,
    CommentsModule,
    FormsModule,
    DashboardModule,
    NovelsModule,
    ReaderModule,
    VipModule,
    CollectModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: SiteAccessGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
