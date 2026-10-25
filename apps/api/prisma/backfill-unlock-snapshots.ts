/**
 * 一次性数据回填：为 ChapterUnlock 补齐章节快照（novelId / chapterNo / title）
 *
 * 背景：ChapterUnlock 新增了快照字段（chapterId 改为可空 + SetNull）。历史解锁记录只有
 * chapterId，一旦章节被删除/重建（采集重导）就无法识别「已购」，读者会被重复收费。
 * 本脚本按 chapterId 关联当前 Chapter 回填快照，**幂等**（只处理 novelId 为空的行，可重复执行）：
 * - chapter 仍在   → 回填 novelId / chapterNo / title
 * - chapter 已删除 → 跳过并计入 skipped（无 chapterId 可关联，无法回填）
 *
 * 用法（生产执行前请先备份数据库）：
 *   cd apps/api && pnpm exec ts-node prisma/backfill-unlock-snapshots.ts
 *   # 仓库根目录：pnpm --filter @wmcms/api exec ts-node prisma/backfill-unlock-snapshots.ts
 *
 * 可选环境变量：
 *   BACKFILL_BATCH_SIZE  分批大小（默认 500）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = Math.max(1, Number(process.env.BACKFILL_BATCH_SIZE ?? 500) || 500);

interface Stats {
  scanned: number;
  backfilled: number;
  skipped: number;
  failed: number;
}

async function backfill(): Promise<Stats> {
  const stats: Stats = { scanned: 0, backfilled: 0, skipped: 0, failed: 0 };
  let cursor: string | undefined;

  for (;;) {
    // 游标分页：只取 novelId 为空的历史行，回填后会自动离开该集合，因此按 id 游标推进
    const rows = await prisma.chapterUnlock.findMany({
      where: { novelId: null },
      select: { id: true, chapterId: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;

    const chapterIds = rows
      .map((row) => row.chapterId)
      .filter((chapterId): chapterId is string => Boolean(chapterId));
    const chapters = chapterIds.length
      ? await prisma.chapter.findMany({
          where: { id: { in: chapterIds } },
          select: { id: true, novelId: true, chapterNo: true, title: true },
        })
      : [];
    const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

    for (const row of rows) {
      const chapter = row.chapterId ? chapterById.get(row.chapterId) : undefined;
      if (!chapter) {
        // 章节已被删除：没有快照来源，无法回填
        stats.skipped += 1;
        continue;
      }
      try {
        await prisma.chapterUnlock.update({
          where: { id: row.id },
          data: {
            novelId: chapter.novelId,
            chapterNo: chapter.chapterNo,
            title: chapter.title,
          },
        });
        stats.backfilled += 1;
      } catch (error) {
        stats.failed += 1;
        console.error(
          `[backfill] 回填失败 unlock=${row.id} chapter=${row.chapterId}:`,
          (error as Error).message,
        );
      }
    }

    console.log(
      `[backfill] 进度：扫描 ${stats.scanned} / 回填 ${stats.backfilled} / 跳过 ${stats.skipped} / 失败 ${stats.failed}`,
    );
  }

  return stats;
}

async function main(): Promise<void> {
  console.log('[backfill] 开始回填 ChapterUnlock 章节快照（只处理 novelId 为空的历史记录）');
  const stats = await backfill();
  console.log('========================================');
  console.log('[backfill] 完成');
  console.log(`  扫描(scanned)   : ${stats.scanned}`);
  console.log(`  回填(backfilled): ${stats.backfilled}`);
  console.log(`  跳过(skipped)   : ${stats.skipped}（章节已删除，无法回填）`);
  console.log(`  失败(failed)    : ${stats.failed}`);
  console.log('========================================');
  if (stats.failed > 0) {
    // 有失败行时返回非 0，便于运维/CI 感知
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    console.error('[backfill] 执行失败：', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
