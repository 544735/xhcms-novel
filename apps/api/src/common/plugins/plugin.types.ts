import type { BuiltinPluginManifest, PluginHook } from '@wmcms/shared';
import type { Logger } from '@nestjs/common';

export type HookPayload = Record<string, unknown>;

export interface PluginRuntimeContext {
  pluginKey: string;
  config: Record<string, unknown>;
  logger: Logger;
}

/**
 * 钩子处理器：
 * - 入参为「已合并的上下文」，可读取上游插件产出；
 * - 返回对象会浅合并进上下文，供下游插件/业务读取；
 * - 抛异常只记录告警，不影响主流程。
 */
export type HookHandler = (
  payload: HookPayload,
  ctx: PluginRuntimeContext,
) => Promise<HookPayload | void> | HookPayload | void;

export interface BuiltinPluginDefinition {
  manifest: BuiltinPluginManifest;
  handlers: Partial<Record<PluginHook, HookHandler>>;
}
