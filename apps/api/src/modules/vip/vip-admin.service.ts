import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CoinTransaction, type Order, type Wallet } from '@prisma/client';
import type { CoinTransactionItem, Paginated, RechargeOrder } from '@wmcms/shared';
import { AuditService } from '../../common/audit/audit.service';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sanitizePlainText } from '../../common/utils/sanitize.util';
import type { AuthenticatedRequest } from '../../common/types';
import type {
  CreditWalletDto,
  QueryVipOrderDto,
  QueryVipTransactionDto,
  QueryVipUnlockDto,
} from './dto/vip.dto';
import { toCoinTransactionItem, toRechargeOrder } from './wallet.service';

type OrderWithMember = Order & {
  member: { id: string; username: string; nickname: string | null; email: string };
};

/** 管理端订单条目（含会员信息） */
export interface AdminOrderItem extends RechargeOrder {
  member: { id: string; username: string; nickname: string | null; email: string };
}

/** 管理端解锁记录条目 */
export interface AdminUnlockItem {
  id: string;
  coins: number;
  createdAt: string;
  member: { id: string; username: string; nickname: string | null };
  /** 章节被删除后为 null（ChapterUnlock.chapter 已改为 SetNull，记录凭快照保留） */
  chapter: {
    id: string;
    chapterNo: number;
    title: string;
    novel: { id: string; title: string };
  } | null;
  /** 章节快照：章节删除/重建后仍可识别解锁对象 */
  snapshot: { novelId: string | null; chapterNo: number | null; title: string | null };
}

/** 管理端书币流水条目（含会员信息） */
export interface AdminTransactionItem extends CoinTransactionItem {
  member: { id: string; username: string; nickname: string | null };
}

function toAdminOrder(row: OrderWithMember): AdminOrderItem {
  return {
    ...toRechargeOrder(row),
    member: {
      id: row.member.id,
      username: row.member.username,
      nickname: row.member.nickname,
      email: row.member.email,
    },
  };
}

function toAdminTransaction(
  row: CoinTransaction & { member: { id: string; username: string; nickname: string | null } },
): AdminTransactionItem {
  return {
    ...toCoinTransactionItem(row),
    member: {
      id: row.member.id,
      username: row.member.username,
      nickname: row.member.nickname,
    },
  };
}

/** VIP 管理端：订单 / 解锁记录 / 书币流水 / 人工调整书币 */
@Injectable()
export class VipAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** GET /vip/orders */
  async listOrders(siteId: string, query: QueryVipOrderDto): Promise<Paginated<AdminOrderItem>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.OrderWhereInput = {
      member: { siteId },
      ...(query.status ? { status: query.status } : {}),
      ...(keyword
        ? {
            OR: [
              { orderNo: { contains: keyword } },
              { member: { username: { contains: keyword } } },
              { member: { nickname: { contains: keyword } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          member: { select: { id: true, username: true, nickname: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map(toAdminOrder), total, page, pageSize);
  }

  /** GET /vip/unlocks */
  async listUnlocks(
    siteId: string,
    query: QueryVipUnlockDto,
  ): Promise<Paginated<AdminUnlockItem>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    // 章节被删除（chapterId 置空）的解锁记录只剩快照 novelId，需要本站书籍 id 集合才能筛出来
    const siteNovelIds = (
      await this.prisma.novel.findMany({
        where: { siteId, ...(query.novelId ? { id: query.novelId } : {}) },
        select: { id: true },
      })
    ).map((row) => row.id);

    const where: Prisma.ChapterUnlockWhereInput = {
      ...(query.memberId ? { memberId: query.memberId } : {}),
      OR: [
        // 章节仍存在：按 chapter.novel.siteId 归属本站
        { chapter: { novel: { siteId, ...(query.novelId ? { id: query.novelId } : {}) } } },
        // 章节已删除/重建：按快照 novelId 归属本站
        { novelId: { in: siteNovelIds } },
      ],
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.chapterUnlock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          member: { select: { id: true, username: true, nickname: true } },
          chapter: {
            select: {
              id: true,
              chapterNo: true,
              title: true,
              novel: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.chapterUnlock.count({ where }),
    ]);

    const items: AdminUnlockItem[] = rows.map((row) => ({
      id: row.id,
      coins: row.coins,
      createdAt: row.createdAt.toISOString(),
      member: {
        id: row.member.id,
        username: row.member.username,
        nickname: row.member.nickname,
      },
      chapter: row.chapter
        ? {
            id: row.chapter.id,
            chapterNo: row.chapter.chapterNo,
            title: row.chapter.title,
            novel: { id: row.chapter.novel.id, title: row.chapter.novel.title },
          }
        : null,
      snapshot: {
        novelId: row.novelId,
        chapterNo: row.chapterNo,
        title: row.title,
      },
    }));

    return paginate(items, total, page, pageSize);
  }

  /** GET /vip/transactions */
  async listTransactions(
    siteId: string,
    query: QueryVipTransactionDto,
  ): Promise<Paginated<AdminTransactionItem>> {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.CoinTransactionWhereInput = {
      member: { siteId },
      ...(query.type ? { type: query.type } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { member: { select: { id: true, username: true, nickname: true } } },
      }),
      this.prisma.coinTransaction.count({ where }),
    ]);

    return paginate(rows.map(toAdminTransaction), total, page, pageSize);
  }

  /** POST /vip/credit：人工调整书币（正负均可，调整后余额不得为负） */
  async credit(
    siteId: string,
    dto: CreditWalletDto,
    req?: AuthenticatedRequest,
  ): Promise<{ balance: number }> {
    const member = await this.prisma.member.findFirst({
      where: { id: dto.memberId, siteId },
      select: { id: true, username: true },
    });
    if (!member) throw new NotFoundException('会员不存在');

    const amount = Math.trunc(Number(dto.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('调整金额不能为 0');
    }
    const remark = sanitizePlainText(dto.remark, 200) || '管理员调整书币';

    const balance = await this.prisma.$transaction(async (tx) => {
      // 原子增减：与用户消费并发时不能按旧余额覆写
      await tx.wallet.upsert({
        where: { memberId: member.id },
        create: { memberId: member.id, balance: 0 },
        update: {},
      });

      let updatedWallet: Wallet;
      if (amount > 0) {
        updatedWallet = await tx.wallet.update({
          where: { memberId: member.id },
          data: { balance: { increment: amount } },
        });
      } else {
        // 扣减用条件更新：调整后余额不得为负
        const deducted = await tx.wallet.updateMany({
          where: { memberId: member.id, balance: { gte: -amount } },
          data: { balance: { decrement: -amount } },
        });
        if (deducted.count === 0) {
          throw new BadRequestException('余额不足，调整后书币不能为负数');
        }
        updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { memberId: member.id } });
      }

      await tx.coinTransaction.create({
        data: {
          memberId: member.id,
          type: amount > 0 ? 'reward' : 'consume',
          amount,
          balance: updatedWallet.balance,
          refType: 'admin',
          refId: req?.authContext?.id ?? null,
          remark,
        },
      });
      return updatedWallet.balance;
    });

    await this.audit.log(req, {
      action: 'vip.credit',
      resource: 'wallet',
      resourceId: member.id,
      detail: { memberId: member.id, username: member.username, amount, balance, remark },
    });

    return { balance };
  }
}
