'use client';

import type { SettingsMap, SettingItem } from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save, Settings2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { PermissionGate } from '@/components/admin/system/permission-gate';
import { QueryErrorState } from '@/components/admin/system/state-views';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';

interface SettingsFormState {
  title: string;
  description: string;
  icp: string;
  copyright: string;
  primaryColor: string;
  keywords: string;
  commentAudit: boolean;
  postsPerPage: string;
  heroTitle: string;
  heroSubtitle: string;
}

function readSetting(data: SettingsMap | undefined, group: string, key: string): string {
  return data?.[group]?.[key] ?? '';
}

function buildForm(data?: SettingsMap): SettingsFormState {
  return {
    title: readSetting(data, 'general', 'title'),
    description: readSetting(data, 'general', 'description'),
    icp: readSetting(data, 'general', 'icp'),
    copyright: readSetting(data, 'general', 'copyright'),
    primaryColor: readSetting(data, 'general', 'primaryColor'),
    keywords: readSetting(data, 'seo', 'keywords'),
    commentAudit: readSetting(data, 'comment', 'commentAudit') !== 'false',
    postsPerPage: readSetting(data, 'home', 'postsPerPage') || '10',
    heroTitle: readSetting(data, 'home', 'heroTitle'),
    heroSubtitle: readSetting(data, 'home', 'heroSubtitle'),
  };
}

function SettingsContent() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const currentSite = useAuthStore((state) => state.currentSite());
  const canUpdate = hasPermission('setting:update');

  const [tab, setTab] = React.useState('general');
  const [form, setForm] = React.useState<SettingsFormState>(buildForm());

  const settingsQuery = useQuery({
    queryKey: ['settings', 'site', currentSiteId],
    queryFn: () => api.settings.get(currentSiteId),
    enabled: Boolean(currentSiteId),
  });

  React.useEffect(() => {
    if (settingsQuery.data) setForm(buildForm(settingsQuery.data));
  }, [settingsQuery.data]);

  const update = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: (items: SettingItem[]) => api.settings.update(items, currentSiteId),
    onSuccess: () => {
      toast.success('站点设置已保存');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : '设置保存失败，请稍后重试');
    },
  });

  const handleSave = () => {
    const postsPerPage = Number(form.postsPerPage);
    if (!Number.isInteger(postsPerPage) || postsPerPage < 1 || postsPerPage > 100) {
      toast.error('每页条数需为 1-100 之间的整数');
      setTab('home');
      return;
    }
    const items: SettingItem[] = [
      { key: 'title', value: form.title.trim(), group: 'general' },
      { key: 'description', value: form.description.trim(), group: 'general' },
      { key: 'icp', value: form.icp.trim(), group: 'general' },
      { key: 'copyright', value: form.copyright.trim(), group: 'general' },
      { key: 'primaryColor', value: form.primaryColor.trim(), group: 'general' },
      { key: 'keywords', value: form.keywords.trim(), group: 'seo' },
      { key: 'commentAudit', value: form.commentAudit ? 'true' : 'false', group: 'comment' },
      { key: 'postsPerPage', value: String(postsPerPage), group: 'home' },
      { key: 'heroTitle', value: form.heroTitle.trim(), group: 'home' },
      { key: 'heroSubtitle', value: form.heroSubtitle.trim(), group: 'home' },
    ];
    saveMutation.mutate(items);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={currentSite ? `${currentSite.name} · /${currentSite.slug}` : undefined}
        title="站点设置"
        description="维护当前站点的基础信息、SEO、评论策略与首页文案。切换站点后分别保存。"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setForm(buildForm(settingsQuery.data));
                toast.info('已恢复为上次保存的内容');
              }}
              disabled={!settingsQuery.data || saveMutation.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              重置
            </Button>
            <Button loading={saveMutation.isPending} disabled={!canUpdate || !currentSiteId} onClick={handleSave}>
              <Save className="h-4 w-4" />
              保存设置
            </Button>
          </>
        }
      />

      {!currentSiteId ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Settings2}
            title="请先选择站点"
            description="站点设置按站点分别保存，请先在顶部切换或创建站点。"
            action={
              <Link
                href="/admin/sites"
                className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                前往站点管理
              </Link>
            }
          />
        </div>
      ) : settingsQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : settingsQuery.isError ? (
        <QueryErrorState
          title="站点设置加载失败"
          description={
            settingsQuery.error instanceof ApiError ? settingsQuery.error.message : '无法获取设置数据，请稍后重试。'
          }
          onRetry={() => void settingsQuery.refetch()}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>站点配置</CardTitle>
            <CardDescription>修改后点击右上角「保存设置」提交，保存成功即写入数据库。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="general">基础信息</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="comment">评论</TabsTrigger>
                <TabsTrigger value="home">首页</TabsTrigger>
              </TabsList>

              <div className="mt-5">
                <TabsContent value="general">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="站点标题" required htmlFor="setting-title" hint="用于浏览器标题与站点品牌展示">
                      <Input
                        id="setting-title"
                        value={form.title}
                        onChange={(event) => update('title', event.target.value)}
                        placeholder="科技前沿"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                    <Field label="品牌主色" htmlFor="setting-primary-color" hint="门户主题强调色，如 #6366f1">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) ? form.primaryColor : '#6366f1'}
                          onChange={(event) => update('primaryColor', event.target.value)}
                          className="h-9.5 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-card p-1"
                          aria-label="选择品牌主色"
                          disabled={!canUpdate || saveMutation.isPending}
                        />
                        <Input
                          id="setting-primary-color"
                          value={form.primaryColor}
                          onChange={(event) => update('primaryColor', event.target.value)}
                          placeholder="#6366f1"
                          className="min-w-0 font-mono"
                          disabled={!canUpdate || saveMutation.isPending}
                        />
                      </div>
                    </Field>
                    <Field label="站点描述" htmlFor="setting-description" className="sm:col-span-2">
                      <Textarea
                        id="setting-description"
                        rows={3}
                        value={form.description}
                        onChange={(event) => update('description', event.target.value)}
                        placeholder="一句话介绍站点内容与定位"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                    <Field label="备案号 ICP" htmlFor="setting-icp">
                      <Input
                        id="setting-icp"
                        value={form.icp}
                        onChange={(event) => update('icp', event.target.value)}
                        placeholder="京ICP备2026000001号"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                    <Field label="版权信息" htmlFor="setting-copyright">
                      <Input
                        id="setting-copyright"
                        value={form.copyright}
                        onChange={(event) => update('copyright', event.target.value)}
                        placeholder="© 2026 科技前沿"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                  </div>
                </TabsContent>

                <TabsContent value="seo">
                  <div className="space-y-4">
                    <Field
                      label="SEO 关键词"
                      htmlFor="setting-keywords"
                      hint="多个关键词建议使用英文逗号分隔；标题与描述取自「基础信息」"
                    >
                      <Input
                        id="setting-keywords"
                        value={form.keywords}
                        onChange={(event) => update('keywords', event.target.value)}
                        placeholder="技术,前端,Node.js,NestJS"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                      搜索引擎摘要优先使用文章自身的 SEO 字段；站点级设置作为兜底。
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="comment">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">评论先审后发</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          开启后新评论默认进入待审核状态，通过后才会在门户展示。
                        </p>
                      </div>
                      <Switch
                        checked={form.commentAudit}
                        onCheckedChange={(checked) => update('commentAudit', checked)}
                        disabled={!canUpdate || saveMutation.isPending}
                        aria-label="评论先审后发"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      关闭后评论将直接展示；建议在活动期间临时关闭以提升互动效率。
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="home">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="首页每页条数"
                      htmlFor="setting-posts-per-page"
                      hint="1-100 之间的整数"
                      required
                    >
                      <Input
                        id="setting-posts-per-page"
                        type="number"
                        min={1}
                        max={100}
                        value={form.postsPerPage}
                        onChange={(event) => update('postsPerPage', event.target.value)}
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                    <div className="hidden sm:block" />
                    <Field label="首页主标题 Hero 标题" htmlFor="setting-hero-title" className="sm:col-span-2">
                      <Input
                        id="setting-hero-title"
                        value={form.heroTitle}
                        onChange={(event) => update('heroTitle', event.target.value)}
                        placeholder="把复杂的工程问题，讲得足够清楚"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                    <Field label="首页副标题 Hero 副标题" htmlFor="setting-hero-subtitle" className="sm:col-span-2">
                      <Input
                        id="setting-hero-subtitle"
                        value={form.heroSubtitle}
                        onChange={(event) => update('heroSubtitle', event.target.value)}
                        placeholder="每周更新深度技术文章"
                        disabled={!canUpdate || saveMutation.isPending}
                      />
                    </Field>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {!canUpdate ? (
              <p className="mt-5 text-xs text-muted-foreground">
                当前账号只有查看权限，无法保存设置。如需修改，请联系超级管理员。
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PermissionGate permission="setting:view">
      <SettingsContent />
    </PermissionGate>
  );
}
