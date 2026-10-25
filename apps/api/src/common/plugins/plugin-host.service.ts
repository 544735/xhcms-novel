import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BUILTIN_PLUGINS, type PluginHook } from '@wmcms/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BUILTIN_PLUGIN_DEFINITIONS } from './builtin';
import type { BuiltinPluginDefinition, HookHandler, HookPayload } from './plugin.types';

interface RegisteredHandler {
  pluginKey: string;
  fn: HookHandler;
}

/**
 * 插件宿主：负责内置插件注册、启停热加载与钩子广播。
 *
 * 数据流：
 *   DB(plugin.enabled/config) --reload--> handlers(按钩子分组)
 *   业务代码 --runHook(hook, payload)--> 依次执行各插件，浅合并返回值
 *
 * 约定：插件异常只记录日志，不阻塞主流程（插件永远不能打破内容发布）。
 */
@Injectable()
export class PluginHostService implements OnModuleInit {
  private readonly logger = new Logger(PluginHostService.name);
  // 三个快照字段由 reload() 原子替换（构建完成后一次性赋值），故不加 readonly
  private handlers = new Map<PluginHook, RegisteredHandler[]>();
  private configs = new Map<string, Record<string, unknown>>();
  private enabledPlugins = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeed();
    await this.reload();
  }

  /** 补齐内置插件在数据库中的缺失记录（幂等） */
  async ensureSeed(): Promise<void> {
    try {
      for (const manifest of BUILTIN_PLUGINS) {
        const existing = await this.prisma.plugin.findUnique({ where: { key: manifest.key } });
        if (existing) continue;
        await this.prisma.plugin.create({
          data: {
            key: manifest.key,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            author: manifest.author,
            enabled: true,
            builtin: true,
            hooks: JSON.stringify(manifest.hooks),
            config: JSON.stringify(manifest.defaultConfig),
          },
        });
        this.logger.log(`已注册内置插件：${manifest.name} (${manifest.key})`);
      }
    } catch (error) {
      this.logger.warn(`内置插件注册失败：${(error as Error).message}`);
    }
  }

  /**
   * 重新读取插件启用状态与配置（管理端切换开关后立即调用）。
   * 先在局部快照上构建，全部就绪后再一次性原子替换，
   * 避免「clear → await 查库」窗口期内所有钩子处理器静默失效。
   */
  async reload(): Promise<void> {
    let rows: { key: string; config: string | null }[] = [];
    try {
      rows = await this.prisma.plugin.findMany({
        where: { enabled: true },
        select: { key: true, config: true },
      });
    } catch (error) {
      // 读取失败时保留上一份快照，避免故障期间插件能力整体消失
      this.logger.warn(`读取插件配置失败，沿用上一次生效的插件配置：${(error as Error).message}`);
      return;
    }

    const definitions = new Map<string, BuiltinPluginDefinition>(
      BUILTIN_PLUGIN_DEFINITIONS.map((def) => [def.manifest.key, def]),
    );

    const nextHandlers = new Map<PluginHook, RegisteredHandler[]>();
    const nextConfigs = new Map<string, Record<string, unknown>>();
    const nextEnabledPlugins = new Set<string>();
    let handlerCount = 0;
    for (const row of rows) {
      const definition = definitions.get(row.key);
      if (!definition) {
        this.logger.warn(`插件 ${row.key} 已在数据库启用，但缺少运行时实现，已跳过`);
        continue;
      }
      nextEnabledPlugins.add(row.key);
      nextConfigs.set(row.key, {
        ...definition.manifest.defaultConfig,
        ...parseJsonObject(row.config),
      });
      for (const [hook, fn] of Object.entries(definition.handlers)) {
        if (!fn) continue;
        const list = nextHandlers.get(hook as PluginHook) ?? [];
        list.push({ pluginKey: row.key, fn: fn as HookHandler });
        nextHandlers.set(hook as PluginHook, list);
        handlerCount += 1;
      }
    }

    // 同步赋值：中间不存在「空快照」窗口，读路径只会看到旧快照或新快照
    this.handlers = nextHandlers;
    this.configs = nextConfigs;
    this.enabledPlugins = nextEnabledPlugins;

    this.logger.log(
      `插件宿主就绪：${this.enabledPlugins.size} 个插件启用 / ${handlerCount} 个钩子处理器`,
    );
  }

  /** 当前启用插件 key 列表 */
  get enabledPluginKeys(): string[] {
    return Array.from(this.enabledPlugins);
  }

  isEnabled(key: string): boolean {
    return this.enabledPlugins.has(key);
  }

  /**
   * 广播钩子。
   * @param hook 钩子名（见 shared/constants PLUGIN_HOOKS）
   * @param input 初始上下文
   * @returns 合并了所有插件产出的上下文
   */
  async runHook<T extends HookPayload = HookPayload>(
    hook: PluginHook,
    input: HookPayload = {},
  ): Promise<T> {
    let acc: HookPayload = { ...input };
    const registered = this.handlers.get(hook) ?? [];
    for (const { pluginKey, fn } of registered) {
      try {
        const started = Date.now();
        const patch = await fn(acc, {
          pluginKey,
          config: this.configs.get(pluginKey) ?? {},
          logger: this.logger,
        });
        if (patch && typeof patch === 'object') {
          acc = { ...acc, ...patch };
        }
        const cost = Date.now() - started;
        if (cost > 300) {
          this.logger.warn(`插件 ${pluginKey} 钩子 ${hook} 耗时 ${cost}ms，请检查实现`);
        }
      } catch (error) {
        this.logger.warn(`插件 ${pluginKey} 执行钩子 ${hook} 失败：${(error as Error).message}`);
      }
    }
    return acc as T;
  }
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
