import type { ComponentType, ReactNode } from 'react';
import type {
  ChapterContent,
  NovelCard,
  NovelCatalog,
  NovelDetail,
  PublicCategory,
  PublicNovelComment,
  PublicSite,
} from '@wmcms/shared';
import type { PortalSettings, PortalSiteTheme } from '@/lib/site';

/**
 * 三套小说主题的统一契约。
 * 主题只负责「呈现」：数据加载、路由与 SEO 在 (portal) 页面 / 共享视图中完成，
 * 因此同一份数据可以被 modern（星海夜读）/ magazine（墨香书卷）/ minimal（极简纯读）消费。
 */

/** 每个页面的渲染上下文（站点 + 主题配置 + 站点前缀 + 小说分类树） */
export interface PortalContext {
  site: PublicSite;
  theme: PortalSiteTheme;
  settings: PortalSettings;
  /** 站内链接前缀：默认入口为 ''，前缀入口为 '/ink' */
  basePath: string;
  /** 小说分类树（/novel-categories，仅 enabled） */
  categories: PublicCategory[];
  /** 分类接口是否成功返回（失败时不能把未知分类误判成 404） */
  categoriesAvailable: boolean;
}

export interface HeaderProps {
  ctx: PortalContext;
}

export interface FooterProps {
  ctx: PortalContext;
}

export interface HeroProps {
  ctx: PortalContext;
  /** 编辑推荐（isRecommend） */
  recommended: NovelCard[];
  /** 最新更新 */
  latest: NovelCard[];
  /** 热门榜 */
  hot: NovelCard[];
  novelCount: number;
}

export type BookCardVariant = 'default' | 'featured' | 'compact' | 'rank' | 'wide' | 'overlay';

export interface BookCardProps {
  ctx: PortalContext;
  novel: NovelCard;
  variant?: BookCardVariant;
  /** 榜单序号（variant=rank 时展示） */
  rank?: number;
}

export interface BookGridProps {
  ctx: PortalContext;
  novels: NovelCard[];
  variant?: BookCardVariant;
  /** 空数据文案（加载失败由视图层单独处理） */
  emptyText?: string;
  className?: string;
}

/** 阅读器背景皮肤 */
export type ReaderBackground = 'paper' | 'sepia' | 'green' | 'dark' | 'white';

/** 各主题给阅读器的视觉皮肤（服务端 → 客户端仅传可序列化字符串） */
export interface ReaderSkin {
  defaultBackground: ReaderBackground;
  wrapperClass: string;
  headerClass: string;
  titleClass: string;
  contentClass: string;
  /** 正文默认最大宽度（px） */
  defaultWidth: number;
}

export interface BookDetailProps {
  ctx: PortalContext;
  novel: NovelDetail;
  /** 服务端渲染的书评（已审核树） */
  comments: PublicNovelComment[];
  /** 客户端书评组件（web-admin-system 提供的 CommentSection） */
  commentSection: ReactNode;
  /** 客户端书架/收藏操作 */
  bookActions: ReactNode;
  /** 开始阅读 / 继续阅读链接（服务端计算首章或最近进度） */
  startReadingHref: string;
  startReadingLabel: string;
}

export interface ReaderProps {
  ctx: PortalContext;
  chapter: ChapterContent;
  /** 完整目录（目录抽屉用；可能为空，此时退回上下章导航） */
  catalog: NovelCatalog | null;
  /** 服务端渲染的章评（已审核树） */
  comments: PublicNovelComment[];
  /** 客户端章评组件 */
  commentSection: ReactNode;
}

export interface PortalTheme {
  key: 'modern' | 'magazine' | 'minimal';
  displayName: string;
  Header: ComponentType<HeaderProps>;
  Footer: ComponentType<FooterProps>;
  Hero: ComponentType<HeroProps>;
  BookCard: ComponentType<BookCardProps>;
  BookGrid: ComponentType<BookGridProps>;
  BookDetail: ComponentType<BookDetailProps>;
  /** 阅读器皮肤（由主题提供，客户端阅读器按 skin 渲染） */
  readerSkin: ReaderSkin;
}

/* ------------------------------------------------------------------ */
/* 便捷工具                                                             */
/* ------------------------------------------------------------------ */

/** 导航只展示分类树第一层（子分类在分类页内展示） */
export function topCategories(categories: PublicCategory[]): PublicCategory[] {
  return categories.slice(0, 9);
}

export function categoryHref(ctx: PortalContext, category: Pick<PublicCategory, 'slug'>): string {
  return `${ctx.basePath}/category/${category.slug}`;
}

export function bookHref(ctx: PortalContext, novel: Pick<NovelCard, 'slug'>): string {
  return `${ctx.basePath}/book/${novel.slug}`;
}

export function readerHref(
  ctx: PortalContext,
  novel: Pick<NovelCard, 'slug'>,
  chapterNo: number,
): string {
  return `${ctx.basePath}/read/${novel.slug}/${chapterNo}`;
}
