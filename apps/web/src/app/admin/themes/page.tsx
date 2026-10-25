'use client';

import type { Theme } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Palette, RefreshCw, Sparkles } from 'lucide-react';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn } from '@/lib/utils';

const THEME_STYLES: Record<string, { preview: string; tags: string[] }> = {
  modern: {
    preview: 'from-indigo-500 via-violet-500 to-sky-500',
    tags: ['卡片式布局', '渐变强调', '现代化'],
  },
  magazine: {
    preview: 'from-rose-500 via-orange-400 to-amber-300',
    tags: ['杂志排版', '首屏大图', '多栏内容'],
  },
  minimal: {
    preview: 'from-slate-300 via-slate-200 to-white dark:from-slate-700 dark:via-slate-800 dark:to-slate-900',
    tags: ['纯净阅读', '单栏布局', '极简风格'],
  },
};

function ThemePreview({ themeKey, previewUrl }: { themeKey: string; previewUrl: string | null }) {
  const style = THEME_STYLES[themeKey];
  return (
    <div className="relative h-36 overflow-hidden rounded-t-xl border-b border-border/70">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="主题预览" className="h-full w-full object-cover" />
      ) : (
        <div
          className={cn(
            'flex h-full w-full flex-col justify-between bg-gradient-to-br p-4',
            style?.preview ?? 'from-slate-400 via-slate-300 to-slate-200',
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/80" />
            <span className="h-2 w-2 rounded-full bg-white/60" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
            <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-medium text-white">
              {themeKey}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-3/5 rounded bg-white/80" />
            <div className="h-2 w-4/5 rounded bg-white/45" />
            <div className="flex gap-2 pt-1">
              <div className="h-8 flex-1 rounded bg-white/25" />
              <div className="h-8 flex-1 rounded bg-white/20" />
              <div className="h-8 flex-1 rounded bg-white/15" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemesContent() {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const currentSite = useAuthStore((state) => state.currentSite());
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [activatingKey, setActivatingKey] = React.useState<string | null>(null);

  const themesQuery = useQuery({
    queryKey: ['themes', 'list'],
    queryFn: () => api.themes.list(),
  });

  const activateMutation = useMutation({
    mutationFn: ({ siteId, themeKey }: { siteId: string; themeKey: string }) =>
      api.themes.activate(siteId, themeKey),
    onSuccess: async (_data, variables) => {
      const name = themesQuery.data?.find((theme) => theme.key === variables.themeKey)?.name ?? variables.themeKey;
      toast.success(`已切换为「${name}」主题`, { description: '站点前台将在刷新后应用新主题。' });
      await fetchProfile();
      void queryClient.invalidateQueries({ queryKey: ['themes'] });
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      setActivatingKey(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '主题切换失败，请稍后重试');
      setActivatingKey(null);
    },
  });

  const themes: Theme[] = themesQuery.data ?? [];
  const currentThemeKey = currentSite?.themeKey ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={currentSite ? `${currentSite.name} · /${currentSite.slug}` : undefined}
        title="主题模板"
        description="为当前站点选择门户前台的主题模板，切换后立即生效。"
        actions={
          <Button variant="outline" onClick={() => void themesQuery.refetch()} disabled={themesQuery.isFetching}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        }
      />

      {!currentSiteId ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Palette}
            title="请先选择站点"
            description="左侧站点切换器选择站点后，才能为该站点切换主题。"
          />
        </div>
      ) : themesQuery.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
              <Skeleton className="h-36 rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : themesQuery.isError ? (
        <QueryErrorState
          title="主题列表加载失败"
          description={
            themesQuery.error instanceof ApiError ? themesQuery.error.message : '无法获取主题列表，请稍后重试。'
          }
          onRetry={() => void themesQuery.refetch()}
        />
      ) : !themes.length ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState icon={Palette} title="暂无可用主题" description="主题资源尚未初始化，请检查后端主题种子数据。" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => {
            const active = theme.key === currentThemeKey;
            const style = THEME_STYLES[theme.key];
            return (
              <Card
                key={theme.key}
                className={cn(
                  'flex flex-col overflow-hidden transition-shadow',
                  active ? 'ring-2 ring-primary/60' : 'hover:shadow-float',
                )}
              >
                <ThemePreview themeKey={theme.key} previewUrl={theme.preview} />
                <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      {theme.name}
                      {theme.builtin ? <Badge variant="secondary">内置</Badge> : null}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {theme.description || '暂无主题描述'}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {(style?.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                    <Badge variant="info">{theme.activeSites} 个站点使用</Badge>
                  </div>

                  {active ? (
                    <Button variant="secondary" disabled className="w-full">
                      <Check className="h-4 w-4" />
                      当前站点正在使用
                    </Button>
                  ) : hasPermission('theme:update') ? (
                    <Button
                      className="w-full"
                      loading={activatingKey === theme.key}
                      disabled={activateMutation.isPending}
                      onClick={() => {
                        setActivatingKey(theme.key);
                        activateMutation.mutate({ siteId: currentSiteId, themeKey: theme.key });
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      切换到该主题
                    </Button>
                  ) : (
                    <Button variant="outline" disabled className="w-full">
                      无切换权限
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        提示：主题只影响门户前台展示；后台界面与主题无关。切换主题不会修改站点内容。
      </p>
    </div>
  );
}

export default function ThemesPage() {
  return (
    <PermissionGate permission="theme:view">
      <ThemesContent />
    </PermissionGate>
  );
}
