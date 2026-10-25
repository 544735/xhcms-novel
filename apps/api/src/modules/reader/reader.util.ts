import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import type {
  ChapterStatus,
  ChapterSummary,
  LatestChapterRef,
  NovelAuditStatus,
  NovelCard,
  NovelStatus,
} from '@wmcms/shared';
import type { PrismaService } from '../../common/prisma/prisma.service';

/** PrismaService 或交互式事务客户端（重算统计时两者都需要） */
export type DbClient = PrismaService | Prisma.TransactionClient;

/** 书籍卡片所需的最小关联查询：分类引用 + 最新一章（已发布） */
export const novelRefsInclude = Prisma.validator<Prisma.NovelInclude>()({
  category: { select: { id: true, name: true, slug: true } },
  chapters: {
    where: { status: 'published' },
    orderBy: { chapterNo: 'desc' },
    take: 1,
    select: { id: true, chapterNo: true, title: true, updatedAt: true },
  },
});

export type NovelRefRow = Prisma.NovelGetPayload<{ include: typeof novelRefsInclude }>;

/** LatestChapterRef 映射 */
export function toLatestChapterRef(row: {
  id: string;
  chapterNo: number;
  title: string;
  updatedAt: Date;
}): LatestChapterRef {
  return {
    id: row.id,
    chapterNo: row.chapterNo,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 数据库书籍行（含分类与最新章节）→ 共享契约 NovelCard */
export function toNovelCard(novel: NovelRefRow): NovelCard {
  return {
    id: novel.id,
    siteId: novel.siteId,
    categoryId: novel.categoryId,
    authorId: novel.authorId,
    authorName: novel.authorName,
    title: novel.title,
    slug: novel.slug,
    cover: novel.cover,
    summary: novel.summary,
    status: novel.status as NovelStatus,
    auditStatus: novel.auditStatus as NovelAuditStatus,
    isRecommend: novel.isRecommend,
    isTop: novel.isTop,
    words: novel.words,
    chapterCount: novel.chapterCount,
    views: novel.views,
    favorites: novel.favorites,
    vipOnly: novel.vipOnly,
    publishedAt: novel.publishedAt ? novel.publishedAt.toISOString() : null,
    lastChapterAt: novel.lastChapterAt ? novel.lastChapterAt.toISOString() : null,
    updatedAt: novel.updatedAt.toISOString(),
    category: novel.category
      ? { id: novel.category.id, name: novel.category.name, slug: novel.category.slug }
      : null,
    latestChapter: novel.chapters.length > 0 ? toLatestChapterRef(novel.chapters[0]) : null,
  };
}

/** 数据库章节行 → 共享契约 ChapterSummary */
export function toChapterSummary(row: {
  id: string;
  novelId: string;
  volumeId: string | null;
  chapterNo: number;
  title: string;
  wordCount: number;
  isVip: boolean;
  price: number;
  status: string;
  views: number;
  publishedAt: Date | null;
  updatedAt: Date;
}): ChapterSummary {
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

/** 中文字符 + 英文/数字单词：与 chapter-stats 插件、seed 保持一致的字数口径 */
export function countChapterWords(text: string | null | undefined): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return cjk + latin;
}

/**
 * 章节正文清洗：去 HTML 标签、统一换行、压缩连续空行，保留段落。
 * 小说正文与文章富文本不同，不能像 sanitizePlainText 那样压成一行。
 */
export function sanitizeChapterContent(input: string | null | undefined): string {
  if (!input) return '';
  const stripped = sanitizeHtml(String(input), { allowedTags: [], allowedAttributes: {} });
  return stripped
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 按 slug 解析启用中的站点（门户接口统一入口） */
export async function resolveActiveSite(prisma: PrismaService, siteSlug: string) {
  const site = await prisma.site.findUnique({ where: { slug: siteSlug } });
  if (!site || site.status !== 'enabled') {
    throw new NotFoundException('站点不存在或已停用');
  }
  return site;
}

/** 校验会员 token 中的会员属于当前站点且状态正常 */
export async function requireActiveMember(prisma: PrismaService, siteId: string, memberId: string) {
  const member = await prisma.member.findFirst({
    where: { id: memberId, siteId, status: 'active' },
  });
  if (!member) {
    throw new ForbiddenException('会员账号不属于当前站点或已被禁用');
  }
  return member;
}

/** 可选会员（OptionalMemberAuthGuard）：token 有效但会员被禁用/跨站时按匿名处理 */
export async function resolveOptionalMember(
  prisma: PrismaService,
  siteId: string,
  memberId: string | undefined | null,
) {
  if (!memberId) return null;
  return prisma.member.findFirst({ where: { id: memberId, siteId, status: 'active' } });
}

/** 站点 settings JSON 字符串 → 对象（容错） */
export function parseSiteSettings(settings: string | null | undefined): Record<string, unknown> {
  if (!settings) return {};
  try {
    const parsed: unknown = JSON.parse(settings);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 站点 settings.commentAudit（默认开启审核） */
export function resolveCommentAudit(settings: string | null | undefined): boolean {
  const parsed = parseSiteSettings(settings);
  return typeof parsed.commentAudit === 'boolean' ? parsed.commentAudit : true;
}

/**
 * 重算书籍统计：只统计已发布章节（草稿不计入对外字数/章节数）。
 * 覆盖 Novel.words / chapterCount / lastChapterAt（updatedAt 由 Prisma @updatedAt 自动刷新）。
 */
export async function recomputeNovelStats(db: DbClient, novelId: string): Promise<void> {
  const chapters = await db.chapter.findMany({
    where: { novelId, status: 'published' },
    select: { wordCount: true, publishedAt: true, updatedAt: true },
  });

  let words = 0;
  let lastChapterAt: Date | null = null;
  for (const chapter of chapters) {
    words += chapter.wordCount;
    if (!chapter.publishedAt) continue;
    if (!lastChapterAt || chapter.publishedAt > lastChapterAt) {
      lastChapterAt = chapter.publishedAt;
    }
  }

  await db.novel.update({
    where: { id: novelId },
    data: { words, chapterCount: chapters.length, lastChapterAt },
  });
}

/** 百分比归一化：既接受 0-1 小数，也接受 0-100 整数，统一存 0-1 */
export function normalizePercent(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const ratio = num > 1 ? num / 100 : num;
  return Math.min(1, Math.max(0, Number(ratio.toFixed(4))));
}

/** 今日零点 */
export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
