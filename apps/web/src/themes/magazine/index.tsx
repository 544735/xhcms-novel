import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  Feather,
  Library,
  Sparkles,
  Star,
} from 'lucide-react';
import { SearchForm } from '@/components/portal/server/client/search-form';
import { PortalThemeToggle } from '@/components/portal/server/client/theme-toggle';
import { formatDate, formatNumber } from '@/lib/utils';
import {
  AuthorLink,
  CategoryChips,
  ChapterCatalog,
  EmptyNotice,
  LatestChapterLine,
  NovelCategoryTag,
  NovelCover,
  NovelMeta,
  SectionHeading,
  SiteMark,
  CategoryNav,
  StatusBadge,
  formatChapters,
  formatWords,
} from '../shared';
import { bookHref, categoryHref, readerHref, topCategories } from '../types';
import type {
  BookCardProps,
  BookDetailProps,
  BookGridProps,
  FooterProps,
  HeaderProps,
  HeroProps,
  PortalTheme,
} from '../types';

/**
 * magazine：墨香书卷（古言 / 现言 / 幻想）。
 * 特征：衬线刊头、纸色底、大图头条 + 编号侧栏、细线分隔、羊皮纸阅读器皮肤。
 */

const PAPER = 'bg-[#faf7f0] dark:bg-background';

function Header({ ctx }: HeaderProps) {
  const { basePath } = ctx;
  const today = formatDate(new Date());
  return (
    <header className={`sticky top-0 z-40 border-b-2 border-foreground/80 ${PAPER}/95 backdrop-blur dark:bg-background/95`}>
      <div className="border-b border-border">
        <div className="container flex h-9 items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="hidden sm:inline">{today}</span>
          <span className="sm:hidden">{ctx.site.name}</span>
          <div className="flex items-center gap-3">
            <Link href={`${basePath}/shelf`} className="hover:text-primary">书架</Link>
            <Link href={`${basePath}/vip`} className="hover:text-primary">充值</Link>
            <Link href={`${basePath}/member`} className="hover:text-primary">会员</Link>
            <PortalThemeToggle />
          </div>
        </div>
      </div>
      <div className="container flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <SiteMark ctx={ctx} />
        <div className="flex items-center gap-4">
          <CategoryNav ctx={ctx} className="hidden items-center gap-5 text-[13px] lg:flex" />
          <SearchForm basePath={basePath} className="hidden sm:flex" />
        </div>
      </div>
      <div className="container no-scrollbar flex items-center gap-4 overflow-x-auto border-t border-border py-2 lg:hidden">
        <CategoryNav ctx={ctx} className="flex items-center gap-4 text-xs" />
      </div>
    </header>
  );
}

function Footer({ ctx }: FooterProps) {
  const { settings, site, basePath } = ctx;
  return (
    <footer className={`mt-16 border-t-2 border-foreground/80 ${PAPER}`}>
      <div className="container flex flex-col items-center gap-3 py-10 text-center">
        <p className="font-serif text-2xl font-bold tracking-[0.2em] text-foreground">{site.name}</p>
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          {site.description || settings.heroSubtitle}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Link href={basePath || '/'} className="hover:text-primary">首页</Link>
          <Link href={`${basePath}/books`} className="hover:text-primary">书库</Link>
          <Link href={`${basePath}/rank`} className="hover:text-primary">排行</Link>
          <Link href={`${basePath}/shelf`} className="hover:text-primary">书架</Link>
          <Link href={`${basePath}/history`} className="hover:text-primary">历史</Link>
          <Link href="/sitemap.xml" className="hover:text-primary">Sitemap</Link>
          <Link href="/rss.xml" className="hover:text-primary">RSS</Link>
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <p>{settings.copyright}</p>
          {settings.icp ? <p>{settings.icp}</p> : null}
        </div>
      </div>
    </footer>
  );
}

function Hero({ ctx, recommended, hot, novelCount }: HeroProps) {
  const { settings } = ctx;
  const lead = recommended[0] ?? hot[0];
  const rest = (recommended.length ? recommended : hot).slice(1, 4);
  return (
    <section className={`border-b border-border ${PAPER}`}>
      <div className="container py-8">
        <div className="mb-6 flex flex-col items-center gap-2 border-b border-border pb-5 text-center">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
            <Feather className="h-3.5 w-3.5" />
            {ctx.site.name}
          </p>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {settings.heroTitle}
          </h1>
          {settings.heroSubtitle ? (
            <p className="text-sm text-muted-foreground">{settings.heroSubtitle}</p>
          ) : null}
          <SearchForm basePath={ctx.basePath} variant="hero" className="mt-2" />
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
          {lead ? (
            <Link href={bookHref(ctx, lead)} className="group relative block overflow-hidden rounded-sm">
              <NovelCover novel={lead} ratio="aspect-[16/10] sm:aspect-[16/9]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 sm:p-7">
                <span className="inline-flex rounded-sm bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                  {lead.category?.name ?? '头条'}
                </span>
                <h2 className="font-serif text-2xl font-bold leading-tight text-white sm:text-4xl">
                  {lead.title}
                </h2>
                {lead.summary ? (
                  <p className="line-clamp-2 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-sm">
                    {lead.summary}
                  </p>
                ) : null}
                <p className="text-[11px] uppercase tracking-wider text-white/65">
                  {lead.authorName} · {formatWords(lead.words)} · {formatChapters(lead.chapterCount)}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-sm border border-dashed border-border text-sm text-muted-foreground">
              新书整理中，敬请期待
            </div>
          )}

          <div className="flex flex-col divide-y divide-border border-t border-border lg:border-t-0">
            <p className="hidden pb-2 font-serif text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground lg:block">
              本期书单
            </p>
            {rest.length ? (
              rest.map((novel, index) => (
                <Link key={novel.id} href={bookHref(ctx, novel)} className="group flex items-start gap-4 py-4 first:pt-3">
                  <span className="font-serif text-2xl font-bold leading-none text-primary/35">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block font-serif text-base font-semibold leading-snug text-foreground group-hover:text-primary">
                      {novel.title}
                    </span>
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                      {novel.authorName} · {novel.category?.name ?? '小说'} · {formatWords(novel.words)}
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="py-6 text-xs text-muted-foreground">更多作品持续上架中。</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            在库 <span className="font-semibold text-foreground">{formatNumber(novelCount)}</span> 本 ·
            <span className="ml-1">{ctx.categories.length} 个分类</span>
          </span>
          <CategoryChips ctx={ctx} />
        </div>
      </div>
    </section>
  );
}

function BookCard({ ctx, novel, variant = 'default', rank }: BookCardProps) {
  const href = bookHref(ctx, novel);

  if (variant === 'compact') {
    return (
      <Link href={href} className="group flex items-baseline gap-3 py-2">
        <span className="font-serif text-xs text-primary/50">{novel.category?.name ?? '小说'}</span>
        <span className="min-w-0 flex-1 truncate font-serif text-sm font-medium text-foreground group-hover:text-primary">
          {novel.title}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{novel.authorName}</span>
      </Link>
    );
  }

  if (variant === 'rank') {
    return (
      <Link href={href} className="group flex items-center gap-3 border-b border-border py-3">
        <span className="w-6 shrink-0 font-serif text-lg font-bold text-primary/50">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-sm font-semibold text-foreground group-hover:text-primary">
            {novel.title}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {novel.authorName} · {formatWords(novel.words)} · {formatChapters(novel.chapterCount)}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
          {formatNumber(novel.views)} 阅
        </span>
        <StatusBadge status={novel.status} />
      </Link>
    );
  }

  if (variant === 'overlay') {
    return (
      <Link href={href} className="group relative block overflow-hidden rounded-sm">
        <NovelCover novel={novel} ratio="aspect-[16/10]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/70">
            {novel.category?.name ?? '小说'}
          </span>
          <h3 className="line-clamp-2 font-serif text-lg font-semibold leading-snug text-white">
            {novel.title}
          </h3>
        </div>
      </Link>
    );
  }

  if (variant === 'wide') {
    return (
      <article className="group flex gap-4 border-b border-border py-4">
        <Link href={href} className="w-20 shrink-0 overflow-hidden rounded-sm">
          <NovelCover novel={novel} ratio="aspect-[3/4]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <NovelCategoryTag ctx={ctx} novel={novel} />
            <StatusBadge status={novel.status} />
          </div>
          <h3 className="line-clamp-1 font-serif text-base font-semibold text-foreground group-hover:text-primary">
            <Link href={href}>{novel.title}</Link>
          </h3>
          {novel.summary ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{novel.summary}</p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <NovelMeta novel={novel} />
            <LatestChapterLine ctx={ctx} novel={novel} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col">
      <Link href={href} className="overflow-hidden rounded-sm border border-border">
        <NovelCover novel={novel} ratio="aspect-[3/4]" />
      </Link>
      <div className="flex flex-1 flex-col gap-1 pt-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          {novel.category?.name ?? '小说'}
        </span>
        <h3 className="line-clamp-1 font-serif text-base font-semibold leading-snug text-foreground group-hover:text-primary">
          <Link href={href}>{novel.title}</Link>
        </h3>
        <p className="truncate text-[11px] text-muted-foreground">{novel.authorName}</p>
        {novel.summary ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{novel.summary}</p>
        ) : null}
        <p className="mt-auto pt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {formatWords(novel.words)} · {formatChapters(novel.chapterCount)} · {novel.status === 'completed' ? '完结' : '连载'}
        </p>
      </div>
    </article>
  );
}

function BookGrid({ ctx, novels, variant = 'default', emptyText, className }: BookGridProps) {
  if (!novels.length) return <EmptyNotice text={emptyText} className={className} />;
  if (variant === 'rank') {
    return (
      <div className={className}>
        {novels.map((novel, index) => (
          <BookCard key={novel.id} ctx={ctx} novel={novel} variant="rank" rank={index + 1} />
        ))}
      </div>
    );
  }
  if (variant === 'wide') {
    return (
      <div className={`grid gap-x-8 sm:grid-cols-2 ${className ?? ''}`}>
        {novels.map((novel) => (
          <BookCard key={novel.id} ctx={ctx} novel={novel} variant="wide" />
        ))}
      </div>
    );
  }
  const gridClass =
    variant === 'featured'
      ? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  return (
    <div className={`${gridClass} ${className ?? ''}`}>
      {novels.map((novel) => (
        <BookCard key={novel.id} ctx={ctx} novel={novel} variant={variant} />
      ))}
    </div>
  );
}

function BookDetail({
  ctx,
  novel,
  commentSection,
  bookActions,
  startReadingHref,
  startReadingLabel,
}: BookDetailProps) {
  const { basePath } = ctx;
  return (
    <div className={`min-h-screen ${PAPER}`}>
      <div className="container py-8">
        <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Link href={basePath || '/'} className="hover:text-primary">首页</Link>
          <span>/</span>
          <Link href={`${basePath}/books`} className="hover:text-primary">书库</Link>
          {novel.category ? (
            <>
              <span>/</span>
              <Link href={categoryHref(ctx, novel.category)} className="hover:text-primary">
                {novel.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        <header className="mx-auto max-w-4xl space-y-4 border-b border-border pb-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
            {novel.category?.name ?? '小说'}
          </p>
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {novel.title}
          </h1>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <AuthorLink ctx={ctx} authorName={novel.authorName} />
            <StatusBadge status={novel.status} />
            <span>{formatWords(novel.words)}</span>
            <span>{formatChapters(novel.chapterCount)}</span>
            <span>{formatNumber(novel.views)} 人气</span>
            <span>{formatNumber(novel.favorites)} 收藏</span>
            {novel.vipOnly ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <Sparkles className="h-3 w-3" />
                VIP
              </span>
            ) : null}
          </p>
        </header>

        <section className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="mx-auto w-36 sm:w-44 lg:mx-0 lg:w-full">
            <div className="overflow-hidden rounded-sm border border-border shadow-sm">
              <NovelCover novel={novel} ratio="aspect-[3/4]" />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={startReadingHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <BookOpen className="h-4 w-4" />
                {startReadingLabel}
              </Link>
              {bookActions}
            </div>
          </div>

          <div className="space-y-4">
            {novel.summary ? (
              <p className="border-l-2 border-primary/50 pl-4 font-serif text-sm leading-7 text-foreground/85">
                {novel.summary}
              </p>
            ) : null}
            {novel.latestChapter ? (
              <div className="flex items-center gap-2 border-y border-border py-2.5 text-sm">
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">最新章节</span>
                <Link
                  href={readerHref(ctx, novel, novel.latestChapter.chapterNo)}
                  className="min-w-0 flex-1 truncate font-serif font-medium hover:text-primary"
                >
                  {novel.latestChapter.title}
                </Link>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDate(novel.latestChapter.updatedAt)}
                </span>
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              更新于 {formatDate(novel.updatedAt)} · 收藏后可在书架追更
            </p>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-5xl border-t-2 border-foreground/80 pt-6">
          <SectionHeading
            title="目录"
            description={`共 ${novel.chapterCount} 章，点击章节开始阅读`}
            icon={<Library className="h-4 w-4" />}
            className="mb-3"
          />
          <ChapterCatalog ctx={ctx} novel={novel} />
        </section>

        <section className="mx-auto mt-10 max-w-5xl">{commentSection}</section>

        <div className="mx-auto mt-10 max-w-5xl border-t border-border pt-4 text-center">
          <Link
            href={`${basePath}/rank`}
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            <Star className="h-3 w-3" />
            看看大家都在读什么
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export const magazineTheme: PortalTheme = {
  key: 'magazine',
  displayName: '墨香书卷',
  Header,
  Footer,
  Hero,
  BookCard,
  BookGrid,
  BookDetail,
  readerSkin: {
    defaultBackground: 'sepia',
    wrapperClass: 'font-serif',
    headerClass: 'font-serif',
    titleClass: 'font-serif',
    contentClass: 'font-serif',
    defaultWidth: 800,
  },
};
