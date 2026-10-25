import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Library,
  ListOrdered,
  Search,
} from 'lucide-react';
import { SearchForm } from '@/components/portal/server/client/search-form';
import { PortalThemeToggle } from '@/components/portal/server/client/theme-toggle';
import { formatDate, formatNumber } from '@/lib/utils';
import {
  CategoryChips,
  ChapterCatalog,
  EmptyNotice,
  LatestChapterLine,
  NovelCategoryTag,
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
 * minimal：极简纯读（文字优先，几乎无装饰）。
 * 特征：白底细线、无封面大图（只用文字行）、单栏窄版心、纯白阅读器皮肤。
 */

function Header({ ctx }: HeaderProps) {
  const { basePath } = ctx;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-4">
        <SiteMark ctx={ctx} compact />
        <div className="flex items-center gap-1 sm:gap-2">
          <CategoryNav ctx={ctx} className="hidden items-center gap-5 text-[13px] md:flex" />
          <SearchForm basePath={basePath} className="hidden sm:flex" />
          <Link href={`${basePath}/rank`} className="hidden px-2 text-xs text-muted-foreground hover:text-foreground sm:inline">
            排行
          </Link>
          <Link href={`${basePath}/shelf`} className="px-2 text-xs text-muted-foreground hover:text-foreground">
            书架
          </Link>
          <Link href={`${basePath}/member`} className="px-2 text-xs text-muted-foreground hover:text-foreground">
            会员
          </Link>
          <PortalThemeToggle />
        </div>
      </div>
      <div className="container no-scrollbar flex items-center gap-4 overflow-x-auto border-t border-border py-2 md:hidden">
        <CategoryNav ctx={ctx} className="flex items-center gap-4 text-xs" />
      </div>
    </header>
  );
}

function Footer({ ctx }: FooterProps) {
  const { settings, basePath } = ctx;
  return (
    <footer className="mt-20 border-t border-border">
      <div className="container flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{ctx.site.name}</p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link href={basePath || '/'} className="hover:text-foreground">首页</Link>
          <Link href={`${basePath}/books`} className="hover:text-foreground">书库</Link>
          <Link href={`${basePath}/rank`} className="hover:text-foreground">排行</Link>
          <Link href={`${basePath}/shelf`} className="hover:text-foreground">书架</Link>
          <Link href={`${basePath}/history`} className="hover:text-foreground">历史</Link>
          <Link href="/sitemap.xml" className="hover:text-foreground">Sitemap</Link>
          <Link href="/rss.xml" className="hover:text-foreground">RSS</Link>
        </div>
        <p className="text-[11px] text-muted-foreground">{settings.copyright}</p>
        {settings.icp ? <p className="text-[11px] text-muted-foreground">{settings.icp}</p> : null}
      </div>
    </footer>
  );
}

function Hero({ ctx, latest, hot, novelCount }: HeroProps) {
  const { settings } = ctx;
  return (
    <section className="border-b border-border">
      <div className="container py-12 sm:py-16">
        <div className="max-w-2xl space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {ctx.site.name}
          </p>
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            {settings.heroTitle}
          </h1>
          {settings.heroSubtitle ? (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {settings.heroSubtitle}
            </p>
          ) : null}
          <SearchForm basePath={ctx.basePath} variant="hero" />
          <p className="text-xs text-muted-foreground">
            在库 {formatNumber(novelCount)} 本 · {ctx.categories.length} 个分类 · 每日更新
          </p>
        </div>
        <CategoryChips ctx={ctx} className="mt-8" />

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
              最新更新
            </p>
            <ul className="divide-y divide-border border-t border-border">
              {latest.slice(0, 6).map((novel) => (
                <li key={novel.id}>
                  <Link href={bookHref(ctx, novel)} className="group flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-foreground group-hover:text-primary">
                      {novel.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(novel.lastChapterAt ?? novel.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
              {!latest.length ? <li className="py-6 text-center text-xs text-muted-foreground">暂无更新</li> : null}
            </ul>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ListOrdered className="h-3.5 w-3.5" />
              热门阅读
            </p>
            <ul className="divide-y divide-border border-t border-border">
              {hot.slice(0, 6).map((novel) => (
                <li key={novel.id}>
                  <Link href={bookHref(ctx, novel)} className="group flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-foreground group-hover:text-primary">
                      {novel.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {novel.authorName} · {formatWords(novel.words)}
                    </span>
                  </Link>
                </li>
              ))}
              {!hot.length ? <li className="py-6 text-center text-xs text-muted-foreground">暂无榜单</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function BookCard({ ctx, novel, variant = 'default', rank }: BookCardProps) {
  const href = bookHref(ctx, novel);

  if (variant === 'compact') {
    return (
      <Link href={href} className="group flex items-baseline justify-between gap-3 border-b border-border py-2.5">
        <span className="min-w-0 truncate text-sm text-foreground group-hover:text-primary">{novel.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{novel.authorName}</span>
      </Link>
    );
  }

  if (variant === 'rank') {
    return (
      <Link href={href} className="group flex items-baseline gap-4 border-b border-border py-3">
        <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground group-hover:text-primary">{novel.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {novel.authorName} · {formatWords(novel.words)} · {formatChapters(novel.chapterCount)}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{formatNumber(novel.views)} 阅</span>
      </Link>
    );
  }

  if (variant === 'overlay' || variant === 'wide') {
    return (
      <Link href={href} className="group flex items-baseline justify-between gap-3 border-b border-border py-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
            {novel.title}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {novel.category?.name ?? '小说'} · {novel.authorName}
          </span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <article className="group flex flex-col gap-1 py-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {novel.category ? (
          <Link href={categoryHref(ctx, novel.category)} className="text-primary hover:underline">
            {novel.category.name}
          </Link>
        ) : null}
        <span>{novel.status === 'completed' ? '完结' : '连载'}</span>
        <span>{formatWords(novel.words)}</span>
        <span>{formatChapters(novel.chapterCount)}</span>
        <span>{formatNumber(novel.views)} 阅</span>
      </div>
      <h3 className="text-[17px] font-medium leading-snug text-foreground">
        <Link href={href} className="hover:text-primary">
          {novel.title}
        </Link>
      </h3>
      <p className="text-xs text-muted-foreground">
        {novel.authorName}
        {novel.latestChapter ? ` · 最新 ${novel.latestChapter.title}` : ''}
      </p>
      {novel.summary ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{novel.summary}</p>
      ) : null}
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
  if (variant === 'wide' || variant === 'overlay' || variant === 'featured') {
    return (
      <div className={className}>
        {novels.map((novel) => (
          <BookCard key={novel.id} ctx={ctx} novel={novel} variant="wide" />
        ))}
      </div>
    );
  }
  return (
    <div className={`divide-y divide-border ${className ?? ''}`}>
      {novels.map((novel) => (
        <BookCard key={novel.id} ctx={ctx} novel={novel} />
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
    <div className="container py-10">
      <article className="mx-auto max-w-3xl">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Link href={basePath || '/'} className="hover:text-foreground">首页</Link>
          <span>/</span>
          <Link href={`${basePath}/books`} className="hover:text-foreground">书库</Link>
          {novel.category ? (
            <>
              <span>/</span>
              <Link href={categoryHref(ctx, novel.category)} className="hover:text-foreground">
                {novel.category.name}
              </Link>
            </>
          ) : null}
        </nav>

        <header className="space-y-3 border-b border-border pb-5">
          <h1 className="text-balance text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            {novel.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{novel.authorName}</span>
            <span>{novel.status === 'completed' ? '完结' : '连载中'}</span>
            <span>{formatWords(novel.words)}</span>
            <span>{formatChapters(novel.chapterCount)}</span>
            <span>{formatNumber(novel.views)} 人气</span>
            <span>{formatNumber(novel.favorites)} 收藏</span>
            {novel.vipOnly ? <span className="text-warning">VIP</span> : null}
          </p>
        </header>

        {novel.summary ? (
          <p className="mt-5 text-sm leading-7 text-foreground/85">{novel.summary}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={startReadingHref}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <BookOpen className="h-4 w-4" />
            {startReadingLabel}
          </Link>
          {bookActions}
        </div>

        {novel.latestChapter ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>最新章节</span>
            <Link
              href={readerHref(ctx, novel, novel.latestChapter.chapterNo)}
              className="min-w-0 flex-1 truncate text-foreground hover:text-primary"
            >
              {novel.latestChapter.title}
            </Link>
            <span>{formatDate(novel.latestChapter.updatedAt)}</span>
          </p>
        ) : null}

        <section className="mt-10 border-t border-border pt-6">
          <SectionHeading
            title="目录"
            description={`共 ${novel.chapterCount} 章`}
            icon={<Library className="h-4 w-4" />}
            className="mb-3"
          />
          <ChapterCatalog ctx={ctx} novel={novel} />
        </section>

        <section className="mt-10">{commentSection}</section>

        <div className="mt-10 border-t border-border pt-4">
          <Link
            href={`${basePath}/rank`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            排行榜
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </article>
    </div>
  );
}

export const minimalTheme: PortalTheme = {
  key: 'minimal',
  displayName: '极简纯读',
  Header,
  Footer,
  Hero,
  BookCard,
  BookGrid,
  BookDetail,
  readerSkin: {
    defaultBackground: 'white',
    wrapperClass: '',
    headerClass: '',
    titleClass: 'font-semibold',
    contentClass: '',
    defaultWidth: 720,
  },
};
