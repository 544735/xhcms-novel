import { notFound } from 'next/navigation';
import { BookOpen, Eye, Heart, Layers } from 'lucide-react';
import type { NovelCard } from '@wmcms/shared';
import { loadPublicResource } from '@/lib/site';
import { getTheme } from '@/themes';
import { formatNumber } from '@/lib/utils';
import { SiteBreadcrumb } from '@/themes/shared';
import { formatChapters, formatWords } from '@/themes/shared';
import { getPortalContext } from '../context';
import { PortalLoadError } from '../load-error';

interface PublicAuthor {
  penName: string;
  bio: string | null;
  stats: { novelCount: number; chapterCount: number; totalWords: number; totalFavorites: number };
  novels: NovelCard[];
}

/** 作者页 /author/[penName]：简介 + 统计 + 作品列表 */
export async function AuthorView({
  basePath,
  siteSlug,
  penName,
}: {
  basePath: string;
  siteSlug?: string;
  penName: string;
}) {
  const result = await getPortalContext(basePath, siteSlug);
  if (result.status === 'not-found') notFound();
  if (result.status === 'error') return <PortalLoadError basePath={basePath} />;

  const { ctx } = result;
  const theme = getTheme(ctx.theme.key);

  const authorResult = await loadPublicResource<PublicAuthor>(
    `/public/sites/${encodeURIComponent(ctx.site.slug)}/authors/${encodeURIComponent(penName)}`,
    { revalidate: 60, tags: [`site:${ctx.site.slug}:author:${penName}`] },
  );

  if (authorResult.status === 'not-found') notFound();
  if (authorResult.status === 'error') return <PortalLoadError basePath={basePath} />;

  const author = authorResult.data;

  return (
    <div className="container py-8">
      <SiteBreadcrumb
        items={[
          { label: '首页', href: basePath || '/' },
          { label: '作者' },
          { label: author.penName },
        ]}
      />

      <header className="mb-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
            {author.penName.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{author.penName}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {author.bio || '这位作者还没有留下简介。'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          {[
            { label: '作品', value: `${formatNumber(author.stats.novelCount)} 本`, icon: BookOpen },
            { label: '章节', value: formatChapters(author.stats.chapterCount), icon: Layers },
            { label: '总字数', value: formatWords(author.stats.totalWords), icon: BookOpen },
            { label: '收藏', value: formatNumber(author.stats.totalFavorites), icon: Heart },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl bg-muted/50 px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            );
          })}
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
          全部作品
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="h-3 w-3" />
          共 {author.novels.length} 本
        </span>
      </div>

      <theme.BookGrid ctx={ctx} novels={author.novels} emptyText="这位作者还没有上架作品" />
    </div>
  );
}
