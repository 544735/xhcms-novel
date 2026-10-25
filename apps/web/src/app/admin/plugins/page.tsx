'use client';

import type { Plugin } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Blocks, Cog, RefreshCw, Zap } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { PluginConfigDialog } from '@/components/admin/system/plugin-config-dialog';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { CardSkeletonGrid } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

function PluginsContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [configPlugin, setConfigPlugin] = React.useState<Plugin | null>(null);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const pluginsQuery = useQuery({
    queryKey: ['plugins', 'list'],
    queryFn: () => api.plugins.list(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['plugins'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api.plugins.update(key, { enabled }),
    onSuccess: (_data, variables) => {
      toast.success('插件已热生效', {
        description: variables.enabled ? '插件已启用，相关钩子立即开始执行。' : '插件已停用，相关钩子不再执行。',
      });
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '插件操作失败，请稍后重试');
    },
    onSettled: () => setPendingKey(null),
  });

  const configMutation = useMutation({
    mutationFn: ({ key, config }: { key: string; config: Record<string, unknown> }) =>
      api.plugins.update(key, { config }),
    onSuccess: () => {
      toast.success('插件配置已保存并热生效');
      invalidate();
      setConfigPlugin(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '配置保存失败，请稍后重试');
    },
  });

  const plugins: Plugin[] = pluginsQuery.data ?? [];
  const enabledCount = plugins.filter((plugin) => plugin.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="插件中心"
        description="通过启停与配置插件，为站点扩展 SEO、目录、阅读时长等能力；开关即时热生效。"
        actions={
          <>
            <Badge variant="info">{enabledCount} / {plugins.length} 已启用</Badge>
            <Button variant="outline" onClick={() => void pluginsQuery.refetch()} disabled={pluginsQuery.isFetching}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </>
        }
      />

      {pluginsQuery.isLoading ? (
        <CardSkeletonGrid count={6} />
      ) : pluginsQuery.isError ? (
        <QueryErrorState
          title="插件列表加载失败"
          description={
            pluginsQuery.error instanceof ApiError ? pluginsQuery.error.message : '无法获取插件列表，请稍后重试。'
          }
          onRetry={() => void pluginsQuery.refetch()}
        />
      ) : !plugins.length ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Blocks}
            title="暂无插件"
            description="内置插件尚未初始化，请检查后端插件种子数据。"
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {plugins.map((plugin) => {
            const canUpdate = hasPermission('plugin:update');
            const toggling = pendingKey === plugin.key;
            const hasConfig = Boolean(plugin.config && Object.keys(plugin.config).length);
            return (
              <Card key={plugin.key} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/5 text-primary">
                      <Blocks className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <span className="truncate">{plugin.name}</span>
                        {plugin.builtin ? <Badge variant="secondary">内置</Badge> : null}
                        <Badge variant="outline">v{plugin.version}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">
                        {plugin.description || '暂无插件描述'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]">{plugin.key}</span>
                    <span className="text-border">·</span>
                    <span>{plugin.author || '未知作者'}</span>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      注册钩子
                    </p>
                    {plugin.hooks.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {plugin.hooks.map((hook) => (
                          <Badge key={hook} variant="purple" className="font-mono">
                            {hook}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">未注册钩子</p>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={plugin.enabled}
                        disabled={!canUpdate || toggling}
                        onCheckedChange={(checked) => {
                          setPendingKey(plugin.key);
                          toggleMutation.mutate({ key: plugin.key, enabled: checked });
                        }}
                        aria-label={`启用 ${plugin.name}`}
                      />
                      {plugin.enabled ? (
                        <span className="inline-flex items-center gap-1 font-medium text-success dark:text-emerald-400">
                          <Zap className="h-3.5 w-3.5" />
                          已启用
                        </span>
                      ) : (
                        <span>已停用</span>
                      )}
                    </label>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canUpdate}
                      onClick={() => setConfigPlugin(plugin)}
                    >
                      <Cog className="h-3.5 w-3.5" />
                      配置{hasConfig ? '' : '（空）'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        提示：插件开关与配置均写入数据库并热生效，单个插件异常不会影响主流程。
      </p>

      <PluginConfigDialog
        open={Boolean(configPlugin)}
        onOpenChange={(open) => {
          if (!open) setConfigPlugin(null);
        }}
        plugin={configPlugin}
        saving={configMutation.isPending}
        onSubmit={(config) => {
          if (!configPlugin) return;
          configMutation.mutate({ key: configPlugin.key, config });
        }}
      />
    </div>
  );
}

export default function PluginsPage() {
  return (
    <PermissionGate permission="plugin:view">
      <PluginsContent />
    </PermissionGate>
  );
}
