import { Global, Module } from '@nestjs/common';
import { PluginHostService } from '../../common/plugins/plugin-host.service';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';

/**
 * 全局插件宿主：业务模块可注入 PluginHostService 并广播钩子。
 * 管理端插件接口（PluginsController）注册在本模块。
 */
@Global()
@Module({
  controllers: [PluginsController],
  providers: [PluginHostService, PluginsService],
  exports: [PluginHostService],
})
export class PluginsModule {}
