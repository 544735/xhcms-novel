'use client';

import {
  ARTICLE_STATUS_LABELS,
  type Article,
  type ArticleInput,
  type ArticleStatus,
  type Tag,
} from '@wmcms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Eye,
  ImagePlus,
  Plus,
  Save,
  Send,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { MediaPickerDialog } from '@/components/admin/media/media-picker-dialog';
import { resolveMediaUrl } from '@/components/admin/media/media-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Label, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { cn, formatDateTime } from '@/lib/utils';
import { ArticlePreviewDialog } from './article-preview-dialog';
import {
  ARTICLE_STATUS_BADGE,
  countContentChars,
  errorText,
  filterCategoryTreeByType,
  flattenCategoryTree,
  fromDatetimeLocal,
  isContentEmpty,
  isValidSlug,
  toDatetimeLocal,
} from './article-utils';

// TipTap 依赖 DOM，必须关闭 SSR 渲染
const ArticleEditor = dynamic(() => import('./article-editor').then((mod) => mod.ArticleEditor), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 p-4">
      <Skeleton className="h-8 w-2/3" />
      <SkeletonText lines={8} />
    </div>
  ),
});

interface ArticleFormState {
  title: string;
  slug: string;
  summary: string;
  content: string;
  cover: string;
  status: ArticleStatus;
  categoryId: string;
  tagIds: string[];
  isTop: boolean;
  isRecommend: boolean;
  publishedAt: string;
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
}

interface FormErrors {
  title?: string;
  content?: string;
  slug?: string;
}

const EMPTY_FORM_STATE: ArticleFormState = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  cover: '',
  status: 'draft',
  categoryId: '',
  tagIds: [],
  isTop: false,
  isRecommend: false,
  publishedAt: '',
  seoTitle: '',
  seoKeywords: '',
  seoDescription: '',
};

function articleToFormState(article: Article): ArticleFormState {
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary ?? '',
    content: article.content,
    cover: article.cover ?? '',
    status: article.status,
    categoryId: article.categoryId ?? '',
    tagIds: article.tags.map((tag) => tag.id),
    isTop: article.isTop,
    isRecommend: article.isRecommend,
    publishedAt: toDatetimeLocal(article.publishedAt),
    seoTitle: article.seoTitle ?? '',
    seoKeywords: article.seoKeywords ?? '',
    seoDescription: article.seoDescription ?? '',
  };
}

function ArticleFormSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description="正在加载文章数据…" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Skeleton className="h-11 w-4/5" />
            <SkeletonText lines={12} />
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <SkeletonText lines={6} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 pt-5">
              <SkeletonText lines={4} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LoadErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={TriangleAlert}
          title="加载失败"
          description={message}
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              重新加载
            </Button>
          }
        />
      </Card>
    </div>
  );
}

export function ArticleForm({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const allowed = articleId ? hasPermission('article:update') : hasPermission('article:create');

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'tree', currentSiteId],
    queryFn: () => api.categories.tree(),
    enabled: allowed,
  });
  const tagsQuery = useQuery({
    queryKey: ['tags', 'options', currentSiteId],
    queryFn: () => api.tags.options(),
    enabled: allowed,
  });
  const articleQuery = useQuery<Article>({
    queryKey: ['article', articleId, currentSiteId],
    queryFn: () => api.articles.get(articleId as string),
    enabled: allowed && Boolean(articleId),
  });

  const articleCategories = React.useMemo(
    () => flattenCategoryTree(filterCategoryTreeByType(categoriesQuery.data ?? [], 'article')),
    [categoriesQuery.data],
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title={articleId ? '编辑文章' : '新建文章'} />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="没有访问权限"
            description="当前账号没有该操作的权限，请联系超级管理员分配。"
            action={
              <Button variant="outline" size="sm" onClick={() => router.push('/admin/articles')}>
                返回文章列表
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const loading =
    categoriesQuery.isLoading ||
    tagsQuery.isLoading ||
    (Boolean(articleId) && articleQuery.isLoading);

  if (loading) {
    return <ArticleFormSkeleton title={articleId ? '编辑文章' : '新建文章'} />;
  }

  if (articleId && articleQuery.isError) {
    return (
      <LoadErrorState
        title="编辑文章"
        message={errorText(articleQuery.error)}
        onRetry={() => void articleQuery.refetch()}
      />
    );
  }

  const article = articleQuery.data ?? null;

  return (
    <ArticleFormFields
      key={article?.id ?? 'new'}
      article={article}
      initial={article ? articleToFormState(article) : EMPTY_FORM_STATE}
      categories={articleCategories}
      tags={tagsQuery.data ?? []}
      categoriesFailed={categoriesQuery.isError}
      tagsFailed={tagsQuery.isError}
    />
  );
}

interface ArticleFormFieldsProps {
  article: Article | null;
  initial: ArticleFormState;
  categories: { id: string; name: string; depth: number }[];
  tags: Tag[];
  categoriesFailed: boolean;
  tagsFailed: boolean;
}

function ArticleFormFields({
  article,
  initial,
  categories,
  tags,
  categoriesFailed,
  tagsFailed,
}: ArticleFormFieldsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canPublish = hasPermission('article:publish');

  const [form, setForm] = React.useState<ArticleFormState>(initial);
  const [initialSnapshot, setInitialSnapshot] = React.useState(() => JSON.stringify(initial));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [pendingMode, setPendingMode] = React.useState<'save' | 'publish' | null>(null);

  const currentSnapshot = React.useMemo(() => JSON.stringify(form), [form]);
  const dirty = currentSnapshot !== initialSnapshot;
  const charCount = React.useMemo(() => countContentChars(form.content), [form.content]);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const updateForm = (patch: Partial<ArticleFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const saveMutation = useMutation({
    mutationFn: async ({ input }: { input: ArticleInput; mode: 'save' | 'publish' }) =>
      article ? api.articles.update(article.id, input) : api.articles.create(input),
    onSuccess: async (_result, variables) => {
      setPendingMode(null);
      setInitialSnapshot(currentSnapshot);
      toast.success(variables.mode === 'publish' ? '文章已发布' : '文章已保存');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['articles'] }),
        queryClient.invalidateQueries({ queryKey: ['article'] }),
      ]);
      router.push('/admin/articles');
    },
    onError: (error) => {
      setPendingMode(null);
      toast.error('保存失败', { description: errorText(error) });
    },
  });

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.title.trim()) next.title = '请输入文章标题';
    if (isContentEmpty(form.content)) next.content = '正文不能为空';
    if (form.slug.trim() && !isValidSlug(form.slug)) {
      next.slug = 'slug 只能包含小写字母、数字与连字符';
    }
    setErrors(next);
    const firstError = next.title ?? next.content ?? next.slug;
    if (firstError) toast.error('请检查表单', { description: firstError });
    return !firstError;
  };

  const buildInput = (status: ArticleStatus): ArticleInput => ({
    title: form.title.trim(),
    content: form.content,
    slug: form.slug.trim() || undefined,
    summary: form.summary.trim() || null,
    cover: form.cover.trim() || null,
    status,
    categoryId: form.categoryId || null,
    tagIds: form.tagIds,
    isTop: form.isTop,
    isRecommend: form.isRecommend,
    publishedAt: fromDatetimeLocal(form.publishedAt) ?? undefined,
    seoTitle: form.seoTitle.trim() || null,
    seoKeywords: form.seoKeywords.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
  });

  const handleSave = (mode: 'save' | 'publish') => {
    if (mode === 'publish' && !canPublish) {
      toast.error('没有发布文章的权限');
      return;
    }
    if (!validate()) return;
    setPendingMode(mode);
    saveMutation.mutate({
      input: buildInput(mode === 'publish' ? 'published' : form.status),
      mode,
    });
  };

  const handleBack = () => {
    if (dirty && !window.confirm('有未保存的修改，确定离开当前页面吗？')) return;
    router.push('/admin/articles');
  };

  const statusOptions = (Object.keys(ARTICLE_STATUS_LABELS) as ArticleStatus[]).filter(
    (status) => canPublish || status !== 'published' || status === initial.status,
  );

  const saveHint = saveMutation.isPending
    ? '正在保存…'
    : dirty
      ? '有未保存的修改'
      : article
        ? `已保存 · ${formatDateTime(article.updatedAt)}`
        : '尚未保存';

  return (
    <div className="space-y-6">
      <PageHeader
        title={article ? '编辑文章' : '新建文章'}
        description={
          article
            ? '修改后可保存为草稿或直接发布，未保存离开时会有提示。'
            : '撰写内容并配置发布选项，保存后返回文章列表。'
        }
        eyebrow={
          <Badge variant={ARTICLE_STATUS_BADGE[form.status]}>
            {ARTICLE_STATUS_LABELS[form.status]}
          </Badge>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={handleBack}>
              返回
            </Button>
            {article ? (
              <Button
                variant="outline"
                size="sm"
                icon={<Eye className="h-4 w-4" />}
                onClick={() => setPreviewOpen(true)}
              >
                预览
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              icon={<Save className="h-4 w-4" />}
              loading={pendingMode === 'save'}
              disabled={saveMutation.isPending}
              onClick={() => handleSave('save')}
            >
              保存
            </Button>
            {canPublish ? (
              <Button
                size="sm"
                icon={<Send className="h-4 w-4" />}
                loading={pendingMode === 'publish'}
                disabled={saveMutation.isPending}
                onClick={() => handleSave('publish')}
              >
                发布
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* 左栏：标题 + 富文本正文 */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <Field error={errors.title}>
                <Input
                  value={form.title}
                  onChange={(event) => {
                    updateForm({ title: event.target.value });
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="请输入文章标题"
                  aria-label="文章标题"
                  maxLength={200}
                  className="h-11 border-0 bg-transparent px-1 text-lg font-semibold shadow-none focus-visible:ring-0 sm:text-xl"
                />
              </Field>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Label required>正文</Label>
                  {errors.content ? (
                    <span className="text-xs font-medium text-destructive">{errors.content}</span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'overflow-hidden rounded-xl border',
                    errors.content ? 'border-destructive' : 'border-input',
                  )}
                >
                  <ArticleEditor
                    value={form.content}
                    onChange={(html) => {
                      updateForm({ content: html });
                      if (errors.content) setErrors((prev) => ({ ...prev, content: undefined }));
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>共 {charCount} 字</span>
                  <span className={cn(dirty && !saveMutation.isPending && 'text-warning')}>
                    {saveHint}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO 与链接</CardTitle>
              <CardDescription>影响搜索结果与门户地址，留空时由系统自动处理。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Slug"
                error={errors.slug}
                hint="留空自动生成；仅允许小写字母、数字与连字符"
                htmlFor="article-slug"
              >
                <Input
                  id="article-slug"
                  value={form.slug}
                  onChange={(event) => {
                    updateForm({ slug: event.target.value });
                    if (errors.slug) setErrors((prev) => ({ ...prev, slug: undefined }));
                  }}
                  placeholder="my-article-slug"
                  maxLength={80}
                />
              </Field>
              <Field label="SEO 标题" htmlFor="article-seo-title">
                <Input
                  id="article-seo-title"
                  value={form.seoTitle}
                  onChange={(event) => updateForm({ seoTitle: event.target.value })}
                  placeholder="默认使用文章标题"
                  maxLength={200}
                />
              </Field>
              <Field label="SEO 关键词" hint="多个关键词用英文逗号分隔" htmlFor="article-seo-keywords">
                <Input
                  id="article-seo-keywords"
                  value={form.seoKeywords}
                  onChange={(event) => updateForm({ seoKeywords: event.target.value })}
                  placeholder="CMS, 内容管理, 建站"
                  maxLength={500}
                />
              </Field>
              <Field label="SEO 描述" htmlFor="article-seo-description">
                <Textarea
                  id="article-seo-description"
                  rows={3}
                  value={form.seoDescription}
                  onChange={(event) => updateForm({ seoDescription: event.target.value })}
                  placeholder="默认使用文章摘要"
                  maxLength={500}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* 右栏：发布设置 / 标签 / 封面与摘要 */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>发布设置</CardTitle>
              <CardDescription>状态、栏目与发布时机</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="状态" htmlFor="article-status">
                <Select
                  id="article-status"
                  value={form.status}
                  onChange={(event) => updateForm({ status: event.target.value as ArticleStatus })}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {ARTICLE_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="所属栏目" htmlFor="article-category" hint={categoriesFailed ? '栏目加载失败，请刷新重试' : undefined}>
                <Select
                  id="article-category"
                  value={form.categoryId}
                  onChange={(event) => updateForm({ categoryId: event.target.value })}
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {`${category.depth > 0 ? '— '.repeat(category.depth) : ''}${category.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="发布时间"
                htmlFor="article-published-at"
                hint="留空时点击「发布」会自动取当前时间"
              >
                <Input
                  id="article-published-at"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(event) => updateForm({ publishedAt: event.target.value })}
                />
              </Field>

              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">置顶</p>
                    <p className="text-xs text-muted-foreground">在栏目/首页优先展示</p>
                  </div>
                  <Switch
                    checked={form.isTop}
                    onCheckedChange={(checked) => updateForm({ isTop: checked })}
                    aria-label="置顶"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">推荐</p>
                    <p className="text-xs text-muted-foreground">进入首页推荐位</p>
                  </div>
                  <Switch
                    checked={form.isRecommend}
                    onCheckedChange={(checked) => updateForm({ isRecommend: checked })}
                    aria-label="推荐"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>标签</CardTitle>
              <CardDescription>可多选，用于门户标签聚合页</CardDescription>
            </CardHeader>
            <CardContent>
              {tags.length ? (
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-input bg-card p-2">
                  {tags.map((tag) => {
                    const active = form.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          updateForm({
                            tagIds: active
                              ? form.tagIds.filter((id) => id !== tag.id)
                              : [...form.tagIds, tag.id],
                          })
                        }
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                          active
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {active ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        <span className="max-w-[9rem] truncate">{tag.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-input px-3 py-4 text-center text-xs text-muted-foreground">
                  {tagsFailed ? '标签加载失败，请刷新重试' : '暂无标签，请先到「标签管理」创建'}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                已选择 {form.tagIds.length} 个标签
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>封面与摘要</CardTitle>
              <CardDescription>封面用于列表卡片，摘要用于列表与 SEO</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="封面图片">
                {form.cover ? (
                  <div className="relative overflow-hidden rounded-lg border border-border">
                    <img
                      src={resolveMediaUrl(form.cover)}
                      alt="封面预览"
                      className="h-32 w-full object-cover"
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
                        onClick={() => updateForm({ cover: '' })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCoverPickerOpen(true)}
                    className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-muted/30 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    <ImagePlus className="h-5 w-5" />
                    从媒体库选择封面
                  </button>
                )}
              </Field>
              <Field
                label="摘要"
                hint="用于列表卡片与 SEO 描述，建议 40–120 字"
                htmlFor="article-summary"
              >
                <Textarea
                  id="article-summary"
                  rows={4}
                  value={form.summary}
                  onChange={(event) => updateForm({ summary: event.target.value })}
                  placeholder="简要概括文章内容…"
                  maxLength={500}
                />
              </Field>
            </CardContent>
          </Card>

          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            提示：未保存离开页面时会弹出浏览器确认；保存成功后自动返回
            <Link href="/admin/articles" className="mx-1 text-primary hover:underline">
              文章列表
            </Link>
            。
          </p>
        </div>
      </div>

      <MediaPickerDialog
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        onSelect={(url) => updateForm({ cover: url })}
        title="选择封面图片"
      />

      {article ? (
        <ArticlePreviewDialog
          articleId={article.id}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          fallbackTitle={form.title || article.title}
        />
      ) : null}
    </div>
  );
}
