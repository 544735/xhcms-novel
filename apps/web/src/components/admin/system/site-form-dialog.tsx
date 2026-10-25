'use client';

import type { Site, Theme } from '@wmcms/shared';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import type { SiteInput } from '@/lib/api';

interface SiteFormState {
  name: string;
  slug: string;
  domain: string;
  themeKey: string;
  logo: string;
  description: string;
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
  status: 'enabled' | 'disabled';
}

const EMPTY_FORM: SiteFormState = {
  name: '',
  slug: '',
  domain: '',
  themeKey: 'modern',
  logo: '',
  description: '',
  seoTitle: '',
  seoKeywords: '',
  seoDescription: '',
  status: 'enabled',
};

function toForm(site: Site | null, themes: Theme[]): SiteFormState {
  if (!site) return { ...EMPTY_FORM, themeKey: themes[0]?.key ?? 'modern' };
  return {
    name: site.name,
    slug: site.slug,
    domain: site.domain ?? '',
    themeKey: site.themeKey || themes[0]?.key || 'modern',
    logo: site.logo ?? '',
    description: site.description ?? '',
    seoTitle: site.seoTitle ?? '',
    seoKeywords: site.seoKeywords ?? '',
    seoDescription: site.seoDescription ?? '',
    status: site.status,
  };
}

export interface SiteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site | null;
  themes: Theme[];
  saving: boolean;
  onSubmit: (input: SiteInput) => void;
}

export function SiteFormDialog({
  open,
  onOpenChange,
  site,
  themes,
  saving,
  onSubmit,
}: SiteFormDialogProps) {
  const [form, setForm] = React.useState<SiteFormState>(EMPTY_FORM);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(toForm(site, themes));
    setError(null);
  }, [open, site, themes]);

  const update = <K extends keyof SiteFormState>(key: K, value: SiteFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const name = form.name.trim();
    if (!name) {
      setError('请填写站点名称');
      return;
    }
    const slug = form.slug.trim();
    if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      setError('站点标识只能包含小写字母、数字与连字符');
      return;
    }
    setError(null);
    onSubmit({
      name,
      slug: slug || undefined,
      domain: form.domain.trim() || null,
      themeKey: form.themeKey || 'modern',
      logo: form.logo.trim() || null,
      description: form.description.trim() || null,
      seoTitle: form.seoTitle.trim() || null,
      seoKeywords: form.seoKeywords.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
      status: form.status,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={site ? '编辑站点' : '新建站点'}
      description={site ? `修改 ${site.name} 的站点信息与 SEO 配置` : '创建一个新的站点，创建后可切换主题与管理内容'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {site ? '保存修改' : '创建站点'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="站点名称" required htmlFor="site-name">
            <Input
              id="site-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="科技前沿"
              disabled={saving}
            />
          </Field>
          <Field label="站点标识 slug" hint="用于 URL；修改后门户地址会随之变化" htmlFor="site-slug">
            <Input
              id="site-slug"
              value={form.slug}
              onChange={(event) => update('slug', event.target.value)}
              placeholder="tech"
              disabled={saving}
            />
          </Field>
          <Field label="绑定域名" hint="门户按 Host 匹配，可留空" htmlFor="site-domain">
            <Input
              id="site-domain"
              value={form.domain}
              onChange={(event) => update('domain', event.target.value)}
              placeholder="tech.example.com"
              disabled={saving}
            />
          </Field>
          <Field label="主题模板" htmlFor="site-theme">
            <Select
              id="site-theme"
              value={form.themeKey}
              onChange={(event) => update('themeKey', event.target.value)}
              disabled={saving}
            >
              {themes.length ? (
                themes.map((theme) => (
                  <option key={theme.key} value={theme.key}>
                    {theme.name}
                  </option>
                ))
              ) : (
                <option value="modern">modern</option>
              )}
            </Select>
          </Field>
          <Field label="站点 Logo" hint="图片 URL，可留空" htmlFor="site-logo" className="sm:col-span-2">
            <Input
              id="site-logo"
              value={form.logo}
              onChange={(event) => update('logo', event.target.value)}
              placeholder="/uploads/logo.png"
              disabled={saving}
            />
          </Field>
          <Field label="站点描述" htmlFor="site-description" className="sm:col-span-2">
            <Textarea
              id="site-description"
              rows={2}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="一句话介绍这个站点"
              disabled={saving}
            />
          </Field>
          <Field label="状态" htmlFor="site-status">
            <Select
              id="site-status"
              value={form.status}
              onChange={(event) => update('status', event.target.value as SiteFormState['status'])}
              disabled={saving}
            >
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </Select>
          </Field>
        </div>

        <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO 配置</p>
          <Field label="SEO 标题" htmlFor="site-seo-title">
            <Input
              id="site-seo-title"
              value={form.seoTitle}
              onChange={(event) => update('seoTitle', event.target.value)}
              placeholder="留空则使用站点名称"
              disabled={saving}
            />
          </Field>
          <Field label="SEO 关键词" htmlFor="site-seo-keywords">
            <Input
              id="site-seo-keywords"
              value={form.seoKeywords}
              onChange={(event) => update('seoKeywords', event.target.value)}
              placeholder="多个关键词用英文逗号分隔"
              disabled={saving}
            />
          </Field>
          <Field label="SEO 描述" htmlFor="site-seo-description">
            <Textarea
              id="site-seo-description"
              rows={2}
              value={form.seoDescription}
              onChange={(event) => update('seoDescription', event.target.value)}
              placeholder="用于搜索引擎摘要"
              disabled={saving}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
