import type { Prisma } from '@prisma/client';
import type {
  ChapterStatus,
  ChapterSummary,
  LatestChapterRef,
  NovelAuditStatus,
  NovelCard,
  NovelStatus,
} from '@wmcms/shared';

/** 章节摘要选择列（列表/目录通用，不含正文） */
export const chapterSummarySelect = {
  id: true,
  novelId: true,
  volumeId: true,
  chapterNo: true,
  title: true,
  wordCount: true,
  isVip: true,
  price: true,
  status: true,
  views: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.ChapterSelect;

/** 章节引用选择列（上一章/下一章/最新章节） */
export const chapterRefSelect = {
  id: true,
  chapterNo: true,
  title: true,
  updatedAt: true,
} satisfies Prisma.ChapterSelect;

/** 书籍列表/卡片 include：分类 + 最新章节（仅已发布） */
export const novelListInclude = {
  category: { select: { id: true, name: true, slug: true } },
  chapters: {
    where: { status: 'published' },
    orderBy: { chapterNo: 'desc' },
    take: 1,
    select: chapterRefSelect,
  },
} satisfies Prisma.NovelInclude;

/** 门户书籍详情 include：分类 + 最新章节 + 分卷（仅已发布章节） */
export const publicNovelInclude = {
  category: { select: { id: true, name: true, slug: true } },
  chapters: {
    where: { status: 'published' },
    orderBy: { chapterNo: 'desc' },
    take: 1,
    select: chapterRefSelect,
  },
  volumes: {
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    include: {
      chapters: {
        where: { status: 'published' },
        orderBy: { chapterNo: 'asc' },
        select: chapterSummarySelect,
      },
    },
  },
} satisfies Prisma.NovelInclude;

/** 管理端书籍详情 include：分类 + 全部章节（含草稿） */
export const adminNovelDetailInclude = {
  category: { select: { id: true, name: true, slug: true } },
  volumes: {
    orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    include: {
      chapters: { orderBy: { chapterNo: 'asc' }, select: chapterSummarySelect },
    },
  },
} satisfies Prisma.NovelInclude;

export type NovelRow = Prisma.NovelGetPayload<{ include: typeof novelListInclude }>;
export type PublicNovelRow = Prisma.NovelGetPayload<{ include: typeof publicNovelInclude }>;
export type AdminNovelDetailRow = Prisma.NovelGetPayload<{
  include: typeof adminNovelDetailInclude;
}>;
export type ChapterSummaryRow = Prisma.ChapterGetPayload<{ select: typeof chapterSummarySelect }>;
export type ChapterRefRow = Prisma.ChapterGetPayload<{ select: typeof chapterRefSelect }>;

export function toChapterSummary(row: ChapterSummaryRow): ChapterSummary {
  return {
    id: row.id,
    novelId: row.novelId,
    volumeId: row.volumeId,
    chapterNo: row.chapterNo,
    title: row.title,
    wordCount: row.wordCount,
    isVip: row.isVip,
    price: row.price,
    status: row.status as ChapterStatus,
    views: row.views,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLatestChapterRef(
  row: ChapterRefRow | null | undefined,
): LatestChapterRef | null {
  if (!row) return null;
  return {
    id: row.id,
    chapterNo: row.chapterNo,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toNovelCard(row: NovelRow): NovelCard {
  return {
    id: row.id,
    siteId: row.siteId,
    categoryId: row.categoryId,
    authorId: row.authorId,
    authorName: row.authorName,
    title: row.title,
    slug: row.slug,
    cover: row.cover,
    summary: row.summary,
    status: row.status as NovelStatus,
    auditStatus: row.auditStatus as NovelAuditStatus,
    isRecommend: row.isRecommend,
    isTop: row.isTop,
    words: row.words,
    chapterCount: row.chapterCount,
    views: row.views,
    favorites: row.favorites,
    vipOnly: row.vipOnly,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    lastChapterAt: row.lastChapterAt ? row.lastChapterAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    category: row.category,
    latestChapter: toLatestChapterRef(row.chapters[0]),
  };
}
