import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CoinTransaction, type Order, type Wallet } from '@prisma/client';
import type {
  CoinTransactionItem,
  PageQuery,
  Paginated,
  RechargeOrder,
  UnlockChapterResult,
  WalletInfo,
} from '@wmcms/shared';
import { CHAPTER_DEFAULT_PRICE } from '@wmcms/shared';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { randomSuffix } from '../../common/utils/slug.util';
import { requireActiveMember, resolveActiveSite } from '../reader/reader.util';
import type { CreateRechargeOrderDto } from './dto/vip.dto';
import { RECHARGE_PLANS } from '@wmcms/shared';

export function toRechargeOrder(row: Order): RechargeOrder {
  return {
    id: row.id,
    orderNo: row.orderNo,
    amountCents: row.amountCents,
    coins: row.coins,
    status: row.status as RechargeOrder['status'],
    channel: row.channel,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCoinTransactionItem(row: CoinTransaction): CoinTransactionItem {
  return {
    id: row.id,
    type: row.type as CoinTransactionItem['type'],
    amount: row.amount,
    balance: row.balance,
    remark: row.remark,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * VIP 钱包 / 充值订单 / 章节解锁（会员接口）。
 * 所有余额变更都在同一事务内更新 Wallet 并写 CoinTransaction。
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /** 钱包不存在时自动创建 0 余额（幂等） */
  async ensureWallet(memberId: string): Promise<Wallet> {
    return this.prisma.wallet.upsert({
      where: { memberId },
      create: { memberId, balance: 0 },
      update: {},
    });
  }

  /** GET /public/sites/:slug/members/wallet */
  async info(siteSlug: string, memberId: string): Promise<WalletInfo> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const wallet = await this.ensureWallet(memberId);
    const [rechargeAgg, consumeAgg] = await Promise.all([
      this.prisma.coinTransaction.aggregate({
        where: { memberId, type: 'recharge' },
        _sum: { amount: true },
      }),
      this.prisma.coinTransaction.aggregate({
        where: { memberId, type: 'consume' },
        _sum: { amount: true },
      }),
    ]);

    return {
      balance: wallet.balance,
      totalRecharged: rechargeAgg._sum.amount ?? 0,
      totalConsumed: Math.abs(consumeAgg._sum.amount ?? 0),
    };
  }

  /** GET /public/sites/:slug/members/transactions */
  async transactions(
    siteSlug: string,
    memberId: string,
    query: PageQuery,
  ): Promise<Paginated<CoinTransactionItem>> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.CoinTransactionWhereInput = { memberId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.coinTransaction.count({ where }),
    ]);

    return paginate(rows.map(toCoinTransactionItem), total, page, pageSize);
  }

  /** GET /public/sites/:slug/members/orders */
  async orders(
    siteSlug: string,
    memberId: string,
    query: PageQuery,
  ): Promise<Paginated<RechargeOrder>> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.OrderWhereInput = { memberId };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(rows.map(toRechargeOrder), total, page, pageSize);
  }

  /** POST /public/sites/:slug/members/orders */
  async createOrder(
    siteSlug: string,
    memberId: string,
    dto: CreateRechargeOrderDto,
  ): Promise<RechargeOrder> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const plan = RECHARGE_PLANS.find((item) => item.id === dto.planId);
    if (!plan) throw new BadRequestException('充值套餐不存在');

    const orderNo = await this.generateOrderNo();
    const row = await this.prisma.order.create({
      data: {
        memberId,
        orderNo,
        amountCents: plan.amountCents,
        coins: plan.coins + (plan.bonusCoins ?? 0),
        status: 'pending',
        channel: 'mock',
      },
    });
    return toRechargeOrder(row);
  }

  /** POST /public/sites/:slug/members/orders/:orderNo/pay（模拟支付） */
  async payOrder(
    siteSlug: string,
    memberId: string,
    orderNo: string,
  ): Promise<{ order: RechargeOrder; balance: number }> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const order = await this.prisma.order.findFirst({ where: { orderNo, memberId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === 'paid') {
      throw new BadRequestException('订单已支付，请勿重复支付');
    }
    if (order.status === 'cancelled') {
      throw new BadRequestException('订单已取消，无法支付');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 以状态条件更新，避免并发重复支付
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: 'pending' },
        data: { status: 'paid', paidAt: new Date() },
      });
      if (updated.count === 0) {
        throw new BadRequestException('订单已支付，请勿重复支付');
      }

      // 原子自增：并发支付多笔订单时不能按旧余额覆写（丢币）
      await tx.wallet.upsert({
        where: { memberId },
        create: { memberId, balance: 0 },
        update: {},
      });
      const updatedWallet = await tx.wallet.update({
        where: { memberId },
        data: { balance: { increment: order.coins } },
      });
      await tx.coinTransaction.create({
        data: {
          memberId,
          type: 'recharge',
          amount: order.coins,
          balance: updatedWallet.balance,
          refType: 'order',
          refId: order.orderNo,
          remark: `充值 ${order.coins} 书币`,
        },
      });
      const paidOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      return { order: toRechargeOrder(paidOrder), balance: updatedWallet.balance };
    });

    return result;
  }

  /** POST /public/sites/:slug/members/chapters/:chapterId/unlock */
  async unlockChapter(
    siteSlug: string,
    memberId: string,
    chapterId: string,
  ): Promise<UnlockChapterResult> {
    const site = await resolveActiveSite(this.prisma, siteSlug);
    await requireActiveMember(this.prisma, site.id, memberId);

    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, novel: { siteId: site.id } },
      include: {
        novel: {
          select: { id: true, title: true, siteId: true, authorId: true, vipOnly: true },
        },
      },
    });
    if (!chapter || chapter.status !== 'published') {
      throw new NotFoundException('章节不存在或未发布');
    }

    const wallet = await this.ensureWallet(memberId);
    const needPay = (chapter.novel.vipOnly || chapter.isVip) && chapter.price > 0;

    // 作者本人 / 免费章节：无需扣币，也无需解锁记录
    if (chapter.novel.authorId === memberId || !needPay) {
      return { chapterId: chapter.id, unlocked: true, balance: wallet.balance, spent: 0 };
    }

    // 已购判断：章节 id 命中，或 (novelId, chapterNo) 快照命中
    // ——章节被采集重导/删除重建（id 变化）后仍视为已购，不重复扣费
    const exactUnlock = await this.prisma.chapterUnlock.findUnique({
      where: { memberId_chapterId: { memberId, chapterId: chapter.id } },
      select: { id: true },
    });
    if (exactUnlock) {
      return { chapterId: chapter.id, unlocked: true, balance: wallet.balance, spent: 0 };
    }

    const snapshotUnlock = await this.prisma.chapterUnlock.findFirst({
      where: { memberId, novelId: chapter.novelId, chapterNo: chapter.chapterNo },
      select: { id: true, chapterId: true },
    });
    if (snapshotUnlock) {
      // 命中快照但指向旧章节：把记录重新指向当前章节（不新建、不重复扣费）
      if (snapshotUnlock.chapterId !== chapter.id) {
        try {
          await this.prisma.chapterUnlock.update({
            where: { id: snapshotUnlock.id },
            data: { chapterId: chapter.id },
          });
        } catch (error) {
          // 并发下另一个请求已把同一快照指向当前章节（P2002）：按已解锁处理即可
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
            throw error;
          }
        }
      }
      return { chapterId: chapter.id, unlocked: true, balance: wallet.balance, spent: 0 };
    }

    const price = Math.max(1, chapter.price || CHAPTER_DEFAULT_PRICE);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 余额校验与扣减合并成一次条件更新：并发下不会把余额扣成负数
        const deducted = await tx.wallet.updateMany({
          where: { memberId, balance: { gte: price } },
          data: { balance: { decrement: price } },
        });
        if (deducted.count === 0) {
          throw new BadRequestException('书币不足，请先充值');
        }

        const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { memberId } });
        await tx.chapterUnlock.create({
          data: {
            memberId,
            chapterId: chapter.id,
            coins: price,
            // 快照：章节日后被删除/重建时仍能识别为已购
            novelId: chapter.novelId,
            chapterNo: chapter.chapterNo,
            title: chapter.title,
          },
        });
        await tx.coinTransaction.create({
          data: {
            memberId,
            type: 'consume',
            amount: -price,
            balance: updatedWallet.balance,
            refType: 'chapter',
            refId: chapter.id,
            remark: `解锁《${chapter.novel.title}》${chapter.title}`,
          },
        });
        return {
          chapterId: chapter.id,
          unlocked: true,
          balance: updatedWallet.balance,
          spent: price,
        };
      });
    } catch (error) {
      // 并发下唯一索引冲突：视为已解锁（幂等）
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const current = await this.ensureWallet(memberId);
        return { chapterId: chapter.id, unlocked: true, balance: current.balance, spent: 0 };
      }
      throw error;
    }
  }

  /** 订单号：WM + base36 时间戳 + 随机后缀（唯一） */
  private async generateOrderNo(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderNo = `WM${Date.now().toString(36).toUpperCase()}${randomSuffix(5).toUpperCase()}`;
      const dup = await this.prisma.order.findUnique({ where: { orderNo }, select: { id: true } });
      if (!dup) return orderNo;
    }
    throw new ConflictException('订单号生成冲突，请稍后重试');
  }
}
