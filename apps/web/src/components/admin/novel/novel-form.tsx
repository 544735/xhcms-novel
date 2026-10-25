'use client';

import {
  NOVEL_AUDIT_LABELS,
  NOVEL_STATUS_LABELS,
  type NovelAuditStatus,
  type NovelCard,
  type NovelDetail,
  type NovelInput,
  type NovelStatus,
} from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ImagePlus, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { MediaPickerDialog } from '@/components/admin/media/media-picker-dialog';
import { resolveMediaUrl } from '@/components/admin/media/media-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { categoriesApi, novelsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { errorText, isValidSlug } from './novel-utils';

type NovelRecord = NovelCard | NovelDetail;

interface NovelFormState {
  title: string;
  slug: string;
  authorName: string;
  categoryId: string;
  cover: string;
  summary: string;
  status: NovelStatus;
  auditStatus: NovelAuditStatus;
  isRecommend: boolean;
  isTop: boolean;
  vipOnly: boolean;
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
}

const EMPTY_FORM: NovelFormState = {
  title: '',
  slug: '',
  authorName: '',
  categoryId: '',
  cover: '',
  summary: '',
  status: 'serial',
  auditStatus: 'pending',
  isRecommend: false,
  isTop: false,
  vipOnly: false,
  seoTitle: '',
  seoKeywords: '',
  seoDescription: '',
};

function toFormState(novel: NovelRecord): NovelFormState {
  return {
    title: novel.title,
    slug: novel.slug,
    authorName: novel.authorName,
    categoryId: novel.categoryId ?? '',
    cover: novel.cover ?? '',
    summary: novel.summary ?? '',
    status: novel.status,
    auditStatus: novel.auditStatus,
    isRecommend: novel.isRecommend,
    isTop: novel.isTop,
    vipOnly: novel.vipOnly,
    seoTitle: 'seoTitle' in novel ? (novel.seoTitle ?? '') : '',
    seoKeywords: 'seoKeywords' in novel ? (novel.seoKeywords ?? '') : '',
    seoDescription: 'seoDescription' in novel ? (novel.seoDescription ?? '') : '',
  };
}

export interface NovelFormProps {
  novel?: NovelRecord | null;
  mode: 'create' | 'edit';
}

export function NovelForm({ novel, mode }: NovelFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);

  const initial = React.useMemo(() => (novel ? toFormState(novel) : EMPTY_FORM), [novel]);
  const [form, setForm] = React.useState<NovelFormState>(initial);
  const [errors, setErrors] = React.useState<{ title?: string; authorName?: string; slug?: string }>({});
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);
  const [initialSnapshot, setInitialSnapshot] = React.useState(() => JSON.stringify(initial));

  React.useEffect(() => {
    setForm(initial);
    setInitialSnapshot(JSON.stringify(initial));
    setErrors({});
  }, [initial]);

  const dirty = React.useMemo(() => JSON.stringify(form) !== initialSnapshot, [form, initialSnapshot]);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const categoriesQuery = useQuery({
    queryKey: ['novel-categories', currentSiteId],
    queryFn: () => categoriesApi.list({ type: 'novel' }),
  });

  const update = (patch: Partial<NovelFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const mutation = useMutation({
    mutationFn: (input: NovelInput) =>
      novel ? novelsApi.update(novel.id, input) : novelsApi.create(input),
    onSuccess: async (saved) => {
      toast.success(novel ? '书籍信息已保存' : '书籍已创建');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['novels'] }),
        queryClient.invalidateQueries({ queryKey: ['novel', saved.id] }),
        queryClient.invalidateQueries({ queryKey: ['novel-dashboard'] }),
      ]);
      if (!novel) {
        setInitialSnapshot(JSON.stringify(form));
        router.push(`/admin/novels/${saved.id}/edit`);
      } else {
        setInitialSnapshot(JSON.stringify(form));
      }
    },
    onError: (error) => toast.error('保存失败', { description: errorText(error) }),
  });

  const handleSubmit = () => {
    const next: { title?: string; authorName?: string; slug?: string } = {};
    if (!form.title.trim()) next.title = '请输入书名';
    if (!form.authorName.trim()) next.authorName = '请输入作者笔名';
    if (form.slug.trim() && !isValidSlug(form.slug)) {
      next.slug = 'slug 只能包含小写字母、数字与连字符，且不能以连字符开头';
    }
    setErrors(next);
    if (next.title ?? next.authorName ?? next.slug) {
      toast.error('请检查表单', {
        description: next.title ?? next.authorName ?? next.slug,
      });
      return;
    }

    mutation.mutate({
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      authorName: form.authorName.trim(),
      categoryId: form.categoryId || null,
      cover: form.cover.trim() || null,
      summary: form.summary.trim() || null,
      status: form.status,
      auditStatus: form.auditStatus,
      isRecommend: form.isRecommend,
      isTop: form.isTop,
      vipOnly: form.vipOnly,
      seoTitle: form.seoTitle.trim() || null,
      seoKeywords: form.seoKeywords.trim() || null,
      seoDescription: form.seoDescription.trim() || null,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>书籍信息</CardTitle>
            <CardDescription>书名、作者与分类是门户书库检索的基础信息。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="书名" required error={errors.title} htmlFor="novel-title">
                <Input
                  id="novel-title"
                  value={form.title}
                  maxLength={120}
                  placeholder="如：星海拾遗"
                  onChange={(event) => {
                    update({ title: event.target.value });
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                />
              </Field>
              <Field label="作者笔名" required error={errors.authorName} htmlFor="novel-author">
                <Input
                  id="novel-author"
                  value={form.authorName}
                  maxLength={60}
                  placeholder="作者署名"
                  onChange={(event) => {
                    update({ authorName: event.target.value });
                    if (errors.authorName) setErrors((prev) => ({ ...prev, authorName: undefined }));
                  }}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Slug"
                error={errors.slug}
                hint="留空由系统生成；仅小写字母、数字与连字符"
                htmlFor="novel-slug"
              >
                <Input
                  id="novel-slug"
                  value={form.slug}
                  maxLength={80}
                  placeholder="xing-hai-shi-yi"
                  onChange={(event) => {
                    update({ slug: event.target.value });
                    if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
                  }}
                />
              </Field>
              <Field label="分类" htmlFor="novel-category">
                <Select
                  id="novel-category"
                  value={form.categoryId}
                  onChange={(event) => update({ categoryId: event.target.value })}
                >
                  <option value="">未分类</option>
                  {(categoriesQuery.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="简介" hint="展示在门户书籍详情与列表卡片" htmlFor="novel-summary">
              <Textarea
                id="novel-summary"
                rows={5}
                value={form.summary}
                maxLength={2000}
                placeholder="一句话介绍这本书的故事…"
                onChange={(event) => update({ summary: event.target.value })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO 设置</CardTitle>
            <CardDescription>留空时门户将自动使用书名与简介。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="SEO 标题" htmlFor="novel-seo-title">
              <Input
                id="novel-seo-title"
                value={form.seoTitle}
                maxLength={200}
                onChange={(event) => update({ seoTitle: event.target.value })}
              />
            </Field>
            <Field label="SEO 关键词" hint="多个关键词用英文逗号分隔" htmlFor="novel-seo-keywords">
              <Input
                id="novel-seo-keywords"
                value={form.seoKeywords}
                maxLength={500}
                onChange={(event) => update({ seoKeywords: event.target.value })}
              />
            </Field>
            <Field label="SEO 描述" htmlFor="novel-seo-description">
              <Textarea
                id="novel-seo-description"
                rows={3}
                value={form.seoDescription}
                maxLength={500}
                onChange={(event) => update({ seoDescription: event.target.value })}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>封面与状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="封面">
              {form.cover ? (
                <div className="relative overflow-hidden rounded-lg border border-border">
                  <img
                    src={resolveMediaUrl(form.cover)}
                    alt="封面预览"
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setCoverPickerOpen(true)}
                    >
                      更换
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="移除封面"
                      onClick={() => update({ cover: '' })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCoverPickerOpen(true)}
                  className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <ImagePlus className="h-5 w-5" />
                  从媒体库选择封面
                </button>
              )}
            </Field>

            <Field label="连载状态" htmlFor="novel-status">
              <Select
                id="novel-status"
                value={form.status}
                onChange={(event) => update({ status: event.target.value as NovelStatus })}
              >
                {(Object.keys(NOVEL_STATUS_LABELS) as NovelStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {NOVEL_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="审核状态" htmlFor="novel-audit" hint="管理员可直接调整上架/下架状态">
              <Select
                id="novel-audit"
                value={form.auditStatus}
                onChange={(event) => update({ auditStatus: event.target.value as NovelAuditStatus })}
              >
                {(Object.keys(NOVEL_AUDIT_LABELS) as NovelAuditStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {NOVEL_AUDIT_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">首页推荐</p>
                  <p className="text-xs text-muted-foreground">进入门户推荐位</p>
                </div>
                <Switch
                  checked={form.isRecommend}
                  onCheckedChange={(checked) => update({ isRecommend: checked })}
                  aria-label="推荐"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">置顶</p>
                  <p className="text-xs text-muted-foreground">书库列表优先展示</p>
                </div>
                <Switch
                  checked={form.isTop}
                  onCheckedChange={(checked) => update({ isTop: checked })}
                  aria-label="置顶"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">全书 VIP</p>
                  <p className="text-xs text-muted-foreground">开启后所有章节默认付费</p>
                </div>
                <Switch
                  checked={form.vipOnly}
                  onCheckedChange={(checked) => update({ vipOnly: checked })}
                  aria-label="全书 VIP"
                />
              </div>
            </div>

            {mode === 'edit' && novel ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                <p>
                  章节数 <span className="font-medium text-foreground">{novel.chapterCount}</span> ·
                  总字数 <span className="font-medium text-foreground">{novel.words}</span>
                </p>
                <p className="mt-1">
                  浏览量 {novel.views} · 收藏 {novel.favorites}
                </p>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => {
                if (dirty && !window.confirm('有未保存的修改，确定离开吗？')) return;
                router.push('/admin/novels');
              }}
              className="w-full sm:w-auto"
            >
              取消
            </Button>
            <Button
              size="sm"
              icon={mode === 'create' ? <BookOpen className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              loading={mutation.isPending}
              onClick={handleSubmit}
              className="w-full sm:w-auto"
            >
              {mode === 'create' ? '创建书籍' : '保存修改'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <MediaPickerDialog
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        onSelect={(url) => update({ cover: url })}
        title="选择书籍封面"
      />
    </div>
  );
}
