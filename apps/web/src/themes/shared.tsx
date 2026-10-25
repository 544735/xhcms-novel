import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Layers,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type {
  NovelCard,
  NovelDetail,
  NovelStatus,
  PublicCategory,
} from '@wmcms/shared';
import { NOVEL_STATUS_LABELS } from '@wmcms/shared';
import { formatDate, formatNumber } from '@/lib/utils';
import { pageUrl, portalPath } from '@/lib/site';
import type { PortalContext } from './types';
import { topCategories } from './types';

/**
 * 三套小说主题共享的展示积木（服务端组件）。
 * 只放「三套主题结构一致、仅配色随主题变化」的部分；布局差异留在 themes/{modern,magazine,minimal}。
 */

/* ------------------------------------------------------------------ */
/* 数字格式化                                                           */
/* ------------------------------------------------------------------ */

/** 字数：1.2 万字 / 12 万字 / 123 字 */
export function formatWords(words: number | null | undefined): string {
  if (!words || words <= 0) return '0 字';
  if (words >= 100_000_000) return `${(words / 100_000_000).toFixed(1)} 亿字`;
  if (words >= 10_000) return `${(words / 10_000).toFixed(words >= 100_000 ? 0 : 1)} 万字`;
  return `${formatNumber(words)} 字`;
}

/** 章节数：连载中显示「xx 章」 */
export function formatChapters(count: number | null | undefined): string {
  return `${formatNumber(count ?? 0)} 章`;
}

/* ------------------------------------------------------------------ */
/* 站点标识 / 导航                                                      */
/* ------------------------------------------------------------------ */

export function SiteMark({
  ctx,
  className,
  compact = false,
}: {
  ctx: PortalContext;
  className?: string;
  compact?: boolean;
}) {
  const { site, basePath } = ctx;
  return (
    <Link
      href={basePath || '/'}
      className={`group inline-flex items-center gap-2.5 ${className ?? ''}`}
      aria-label={`${site.name} 首页`}
    >
      {site.logo ? (
        // 站点 logo 可能来自任意图床，使用原生 img 避免 next/image remotePatterns 限制
        <img
          src={site.logo}
          alt={site.name}
          className="h-9 w-9 rounded-xl object-cover ring-1 ring-border"
        />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
          {site.name.slice(0, 1)}
        </span>
      )}
      <span className={compact ? 'sr-only' : 'flex flex-col leading-tight'}>
        <span className="text-[15px] font-semibold tracking-tight text-foreground group-hover:text-primary">
          {site.name}
        </span>
        {site.description ? (
          <span className="hidden max-w-[18rem] truncate text-[11px] text-muted-foreground sm:block">
            {site.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function CategoryNav({ ctx, className }: { ctx: PortalContext; className?: string }) {
  const categories = topCategories(ctx.categories);
  return (
    <nav className={className} aria-label="小说分类">
      <Link
        href={`${ctx.basePath}/books`}
        className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        全部书籍
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`${ctx.basePath}/category/${category.slug}`}
          className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          {category.name}
        </Link>
      ))}
      <Link
        href={`${ctx.basePath}/rank`}
        className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        排行榜
      </Link>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* 封面 / 标签 / 元信息                                                  */
/* ------------------------------------------------------------------ */

/** 书籍封面：无封面时用书名首字 + 渐变占位（theme 通过 className 控制圆角/阴影） */
export function NovelCover({
  novel,
  className,
  ratio = 'aspect-[3/4]',
}: {
  novel: Pick<NovelCard, 'title' | 'cover'>;
  className?: string;
  ratio?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-muted ${ratio} ${className ?? ''}`}>
      {novel.cover ? (
        // 封面来自 CMS 媒体库/外链，使用原生 img 避免 next/image 域名白名单限制
        <img
          src={novel.cover}
          alt={novel.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-muted">
          <span className="px-2 text-center text-2xl font-bold leading-tight text-primary/50">
            {novel.title.slice(0, 2)}
          </span>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: NovelStatus;
  className?: string;
}) {
  const isCompleted = status === 'completed';
  return (
    <span
      className={
        className ??
        `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
          isCompleted
            ? 'bg-success/10 text-success ring-success/20'
            : 'bg-primary/10 text-primary ring-primary/20'
        }`
      }
    >
      {isCompleted ? '完结' : NOVEL_STATUS_LABELS[status]}
    </span>
  );
}

export function NovelMeta({ novel, className }: { novel: NovelCard; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground ${className ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        <BookOpen className="h-3 w-3" />
        {formatChapters(novel.chapterCount)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Layers className="h-3 w-3" />
        {formatWords(novel.words)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Eye className="h-3 w-3" />
        {formatNumber(novel.views)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Heart className="h-3 w-3" />
        {formatNumber(novel.favorites)}
      </span>
    </div>
  );
}

export function NovelCategoryTag({
  ctx,
  novel,
  className,
}: {
  ctx: PortalContext;
  novel: NovelCard;
  className?: string;
}) {
  if (!novel.category) return null;
  return (
    <Link
      href={`${ctx.basePath}/category/${novel.category.slug}`}
      className={
        className ??
        'inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:text-primary'
      }
    >
      {novel.category.name}
    </Link>
  );
}

export function AuthorLink({
  ctx,
  authorName,
  className,
}: {
  ctx: PortalContext;
  authorName: string;
  className?: string;
}) {
  return (
    <Link
      href={`${ctx.basePath}/author/${encodeURIComponent(authorName)}`}
      className={`inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary ${className ?? ''}`}
    >
      <UserRound className="h-3 w-3" />
      {authorName}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* 目录 / 章节                                                          */
/* ------------------------------------------------------------------ */

export function LatestChapterLine({
  ctx,
  novel,
  className,
}: {
  ctx: PortalContext;
  novel: NovelCard;
  className?: string;
}) {
  if (!novel.latestChapter) return null;
  return (
    <Link
      href={`${ctx.basePath}/read/${novel.slug}/${novel.latestChapter.chapterNo}`}
      className={`group/latest inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary ${className ?? ''}`}
    >
      <span className="shrink-0 text-[11px] text-muted-foreground/70">最新</span>
      <span className="truncate">{novel.latestChapter.title}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground/60">
        {formatDate(novel.latestChapter.updatedAt)}
      </span>
    </Link>
  );
}

/** 分卷目录（服务端渲染，原生 details 折叠；书籍详情页用） */
export function ChapterCatalog({
  ctx,
  novel,
  className,
}: {
  ctx: PortalContext;
  novel: NovelDetail;
  className?: string;
}) {
  if (!novel.volumes?.length) {
    return <EmptyNotice text="目录整理中，敬请期待" className={className} />;
  }
  return (
    <div className={`divide-y divide-border ${className ?? ''}`}>
      {novel.volumes.map((volume) => (
        <details key={volume.id} className="group py-3" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
            <span className="flex min-w-0 items-center gap-2">
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="truncate">{volume.title}</span>
              <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
                {volume.chapters.length} 章
              </span>
            </span>
          </summary>
          <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {volume.chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`${ctx.basePath}/read/${novel.slug}/${chapter.chapterNo}`}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-primary"
                >
                  <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                  {chapter.isVip ? (
                    <Sparkles className="h-3 w-3 shrink-0 text-warning" aria-label="VIP 章节" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 通用区块 / 分页                                                      */
/* ------------------------------------------------------------------ */

export function SiteBreadcrumb({
  items,
  className,
}: {
  items: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <nav
      aria-label="面包屑"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground ${className ?? ''}`}
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-primary">
              {item.label}
            </Link>
          ) : (
            <span className="line-clamp-1 text-foreground/70">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionHeading({
  title,
  description,
  href,
  hrefLabel = '查看全部',
  icon,
  className,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className ?? ''}`}>
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <span className="h-4 w-1 rounded-full bg-primary" aria-hidden />
          {icon ? <span className="text-primary">{icon}</span> : null}
          {title}
        </h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {hrefLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/** 服务端分页（Link 驱动，保留站点前缀与额外查询参数） */
export function PaginationLinks({
  page,
  total,
  pageSize,
  basePath,
  pathname,
  query = {},
  className,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  pathname: string;
  /** 额外保留的查询参数（筛选条件等） */
  query?: Record<string, string | number | undefined | null>;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(1, page), totalPages);

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
    if (target > 1) search.set('page', String(target));
    const serialized = search.toString();
    const base = pageUrl(basePath, pathname, 1);
    return serialized ? `${base}?${serialized}` : base;
  };

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let index = 1; index <= totalPages; index += 1) pages.push(index);
  } else {
    pages.push(1);
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    if (start > 2) pages.push('…');
    for (let index = start; index <= end; index += 1) pages.push(index);
    if (end < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }

  const linkClass = (active: boolean) =>
    `inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs transition-colors ${
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary'
    }`;

  return (
    <nav
      className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ''}`}
      aria-label="分页"
    >
      <p className="text-xs text-muted-foreground">
        共 <span className="font-medium text-foreground">{total}</span> 本 · 第 {current}/{totalPages} 页
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {current > 1 ? (
          <Link href={hrefFor(current - 1)} className={linkClass(false)} aria-label="上一页">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        {pages.map((item, index) =>
          item === '…' ? (
            <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={hrefFor(item)}
              className={linkClass(item === current)}
              aria-current={item === current ? 'page' : undefined}
            >
              {item}
            </Link>
          ),
        )}
        {current < totalPages ? (
          <Link href={hrefFor(current + 1)} className={linkClass(false)} aria-label="下一页">
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** 「暂无内容」轻量占位（加载失败由视图层单独处理） */
export function EmptyNotice({ text = '暂无内容', className }: { text?: string; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-12 text-center text-sm text-muted-foreground ${className ?? ''}`}
    >
      {text}
    </div>
  );
}

/** 分类快捷入口（首页/分类页用） */
export function CategoryChips({
  ctx,
  categories,
  className,
}: {
  ctx: PortalContext;
  categories?: PublicCategory[];
  className?: string;
}) {
  const list = categories ?? ctx.categories;
  if (!list.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
      {list.map((category) => (
        <Link
          key={category.id}
          href={`${ctx.basePath}/category/${category.slug}`}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}

export { portalPath };
