import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BookOpen,
  ChevronRight,
  Flame,
  LayoutGrid,
  Library,
  Sparkles,
  Star,
  TrendingUp,
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
 * modern：星海夜读（玄幻 / 科幻书城）。
 * 特征：星海渐变 hero、玻璃拟态吸顶导航、圆角封面卡片、深色阅读器皮肤。
 */

function Header({ ctx }: HeaderProps) {
  const { basePath } = ctx;
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <SiteMark ctx={ctx} className="shrink-0" />
        <CategoryNav ctx={ctx} className="hidden flex-1 items-center gap-5 md:flex" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchForm basePath={basePath} className="hidden sm:flex" />
          <Link
            href={`${basePath}/books`}
            className="hidden rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            书库
          </Link>
          <Link
            href={`${basePath}/rank`}
            className="hidden rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            排行
          </Link>
          <Link
            href={`${basePath}/shelf`}
            className="inline-flex h-8 items-center rounded-full bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
          >
            书架
          </Link>
          <Link
            href={`${basePath}/member`}
            className="hidden rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            会员中心
          </Link>
          <PortalThemeToggle />
        </div>
      </div>
      <div className="container no-scrollbar flex items-center gap-4 overflow-x-auto pb-3 md:hidden">
        <CategoryNav ctx={ctx} className="flex items-center gap-4" />
      </div>
    </header>
  );
}

function Footer({ ctx }: FooterProps) {
  const { settings, site, basePath } = ctx;
  return (
    <footer className="mt-16 border-t border-border bg-card/60">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <SiteMark ctx={ctx} />
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {site.description || settings.heroSubtitle}
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">找书</p>
          <ul className="space-y-2 text-sm">
            <li><Link href={`${basePath}/books`} className="text-muted-foreground hover:text-primary">全部书籍</Link></li>
            <li><Link href={`${basePath}/rank`} className="text-muted-foreground hover:text-primary">排行榜</Link></li>
            <li><Link href={`${basePath}/search`} className="text-muted-foreground hover:text-primary">搜书</Link></li>
            <li><Link href={`${basePath}/shelf`} className="text-muted-foreground hover:text-primary">我的书架</Link></li>
            <li><Link href={`${basePath}/history`} className="text-muted-foreground hover:text-primary">阅读历史</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">分类</p>
          <ul className="space-y-2 text-sm">
            {topCategories(ctx.categories).slice(0, 5).map((category) => (
              <li key={category.id}>
                <Link href={categoryHref(ctx, category)} className="text-muted-foreground hover:text-primary">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-[11px] text-muted-foreground sm:flex-row">
          <p>{settings.copyright}</p>
          <p className="flex items-center gap-3">
            {settings.icp ? <span>{settings.icp}</span> : null}
            <Link href={`${basePath}/vip`} className="hover:text-primary">充值</Link>
            <Link href="/sitemap.xml" className="hover:text-primary">Sitemap</Link>
            <Link href="/rss.xml" className="hover:text-primary">RSS</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function Hero({ ctx, recommended, hot, novelCount }: HeroProps) {
  const { settings } = ctx;
  const lead = recommended[0];
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="hero-mesh absolute inset-0" aria-hidden />
      <div className="dot-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="container relative py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              {ctx.site.name} · 好书每日更新
            </span>
            <h1 className="gradient-text text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {settings.heroTitle}
            </h1>
            {settings.heroSubtitle ? (
              <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {settings.heroSubtitle}
              </p>
            ) : null}
            <SearchForm basePath={ctx.basePath} variant="hero" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span>
                在库 <span className="font-semibold text-foreground">{formatNumber(novelCount)}</span> 本
              </span>
              <span>
                <span className="font-semibold text-foreground">{ctx.categories.length}</span> 个分类
              </span>
              <span>连载 · 完结 · VIP 畅读</span>
            </div>
            <CategoryChips ctx={ctx} className="pt-1" />
          </div>

          {/* 热榜 Top5 */}
          <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-card backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Flame className="h-4 w-4 text-warning" />
                热门榜
              </p>
              <Link href={`${ctx.basePath}/rank`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                更多
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <ul className="divide-y divide-border/70">
              {hot.slice(0, 5).map((novel, index) => (
                <li key={novel.id}>
                  <Link
                    href={bookHref(ctx, novel)}
                    className="group flex items-center gap-3 py-2.5"
                  >
                    <span
                      className={`w-5 shrink-0 text-center text-sm font-bold ${
                        index < 3 ? 'text-primary' : 'text-muted-foreground/60'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                        {novel.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {novel.authorName} · {novel.category?.name ?? '小说'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatNumber(novel.views)} 阅
                    </span>
                  </Link>
                </li>
              ))}
              {!hot.length ? <li className="py-6 text-center text-xs text-muted-foreground">榜单更新中</li> : null}
            </ul>
          </div>
        </div>

        {recommended.length ? (
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Star className="h-4 w-4 text-warning" />
                编辑推荐
              </p>
              <Link href={`${ctx.basePath}/books?sortBy=favorites`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                更多好书
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommended.slice(0, 4).map((novel) => (
                <BookCard key={novel.id} ctx={ctx} novel={novel} variant="overlay" />
              ))}
            </div>
          </div>
        ) : null}

        {lead ? null : (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            推荐位整理中，先去书库逛逛吧。
          </p>
        )}
      </div>
    </section>
  );
}

function BookCard({ ctx, novel, variant = 'default', rank }: BookCardProps) {
  const href = bookHref(ctx, novel);

  if (variant === 'compact') {
    return (
      <Link href={href} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:border-primary/40">
        <div className="w-10 shrink-0 overflow-hidden rounded-md">
          <NovelCover novel={novel} ratio="aspect-[3/4]" />
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
            {novel.title}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {novel.authorName} · {novel.category?.name ?? '小说'}
          </span>
        </span>
        <StatusBadge status={novel.status} />
      </Link>
    );
  }

  if (variant === 'rank') {
    return (
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/40"
      >
        <span
          className={`w-6 shrink-0 text-center text-base font-bold ${
            (rank ?? 99) <= 3 ? 'text-primary' : 'text-muted-foreground/50'
          }`}
        >
          {rank}
        </span>
        <div className="w-11 shrink-0 overflow-hidden rounded-md">
          <NovelCover novel={novel} ratio="aspect-[3/4]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {novel.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {novel.authorName} · {formatWords(novel.words)} · {formatChapters(novel.chapterCount)}
          </p>
        </div>
        <div className="hidden shrink-0 text-right text-[11px] text-muted-foreground sm:block">
          <p>{formatNumber(novel.favorites)} 收藏</p>
          <p>{formatNumber(novel.views)} 阅读</p>
        </div>
        <StatusBadge status={novel.status} />
      </Link>
    );
  }

  if (variant === 'overlay') {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Link href={href} className="block">
          <NovelCover novel={novel} ratio="aspect-[4/5]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              {novel.category?.name ?? '推荐'}
            </span>
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white">
              {novel.title}
            </h3>
            <p className="text-[11px] text-white/70">
              {novel.authorName} · {formatWords(novel.words)}
            </p>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'wide') {
    return (
      <article className="group flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30">
        <Link href={href} className="w-20 shrink-0 overflow-hidden rounded-xl">
          <NovelCover novel={novel} ratio="aspect-[3/4]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <NovelCategoryTag ctx={ctx} novel={novel} />
            <StatusBadge status={novel.status} />
          </div>
          <h3 className="line-clamp-1 text-base font-semibold text-foreground group-hover:text-primary">
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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow">
      <Link href={href} aria-label={novel.title}>
        <NovelCover novel={novel} ratio="aspect-[3/4]" />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <NovelCategoryTag ctx={ctx} novel={novel} />
          <StatusBadge status={novel.status} />
        </div>
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
          <Link href={href}>{novel.title}</Link>
        </h3>
        <p className="truncate text-[11px] text-muted-foreground">{novel.authorName}</p>
        {novel.summary ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{novel.summary}</p>
        ) : null}
        <div className="mt-auto pt-1">
          <NovelMeta novel={novel} />
        </div>
      </div>
    </article>
  );
}

function BookGrid({ ctx, novels, variant = 'default', emptyText, className }: BookGridProps) {
  if (!novels.length) return <EmptyNotice text={emptyText} className={className} />;
  if (variant === 'rank') {
    return (
      <div className={`space-y-2.5 ${className ?? ''}`}>
        {novels.map((novel, index) => (
          <BookCard key={novel.id} ctx={ctx} novel={novel} variant="rank" rank={index + 1} />
        ))}
      </div>
    );
  }
  if (variant === 'wide') {
    return (
      <div className={`grid gap-4 sm:grid-cols-2 ${className ?? ''}`}>
        {novels.map((novel) => (
          <BookCard key={novel.id} ctx={ctx} novel={novel} variant="wide" />
        ))}
      </div>
    );
  }
  const gridClass =
    variant === 'featured'
      ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
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
    <div className="container py-8">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
        <span>/</span>
        <span className="line-clamp-1 text-foreground/70">{novel.title}</span>
      </nav>

      <section className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="mx-auto w-40 sm:w-48 lg:mx-0 lg:w-full">
          <div className="overflow-hidden rounded-2xl border border-border shadow-glow">
            <NovelCover novel={novel} ratio="aspect-[3/4]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-sm font-semibold text-foreground">{formatWords(novel.words)}</p>
              <p className="text-[10px] text-muted-foreground">总字数</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-sm font-semibold text-foreground">{formatChapters(novel.chapterCount)}</p>
              <p className="text-[10px] text-muted-foreground">章节</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-sm font-semibold text-foreground">{formatNumber(novel.views)}</p>
              <p className="text-[10px] text-muted-foreground">人气</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-sm font-semibold text-foreground">{formatNumber(novel.favorites)}</p>
              <p className="text-[10px] text-muted-foreground">收藏</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <NovelCategoryTag ctx={ctx} novel={novel} />
            <StatusBadge status={novel.status} />
            {novel.vipOnly ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                <Sparkles className="h-3 w-3" />
                VIP
              </span>
            ) : null}
            {novel.isRecommend ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Star className="h-3 w-3" />
                编辑推荐
              </span>
            ) : null}
          </div>
          <h1 className="text-balance text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
            {novel.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <AuthorLink ctx={ctx} authorName={novel.authorName} />
            <span>更新于 {formatDate(novel.updatedAt)}</span>
            {novel.lastChapterAt ? <span>最新 {formatDate(novel.lastChapterAt)}</span> : null}
          </div>

          {novel.summary ? (
            <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground/80">
              {novel.summary}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={startReadingHref}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <BookOpen className="h-4 w-4" />
              {startReadingLabel}
            </Link>
            {bookActions}
            <Link
              href={`${basePath}/vip`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Sparkles className="h-4 w-4 text-warning" />
              充值书币
            </Link>
          </div>

          {novel.latestChapter ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-xs text-muted-foreground">最新章节</span>
              <Link
                href={readerHref(ctx, novel, novel.latestChapter.chapterNo)}
                className="min-w-0 flex-1 truncate font-medium text-foreground hover:text-primary"
              >
                {novel.latestChapter.title}
              </Link>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDate(novel.latestChapter.updatedAt)}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-card p-5 shadow-card">
        <SectionHeading
          title="目录"
          description={`共 ${novel.chapterCount} 章 · ${formatWords(novel.words)}`}
          icon={<Library className="h-4 w-4" />}
          className="mb-4"
        />
        <ChapterCatalog ctx={ctx} novel={novel} />
      </section>

      <section className="mt-8">{commentSection}</section>
    </div>
  );
}

export const modernTheme: PortalTheme = {
  key: 'modern',
  displayName: '星海夜读',
  Header,
  Footer,
  Hero,
  BookCard,
  BookGrid,
  BookDetail,
  readerSkin: {
    defaultBackground: 'dark',
    wrapperClass: '',
    headerClass: '',
    titleClass: 'font-semibold',
    contentClass: '',
    defaultWidth: 860,
  },
};
