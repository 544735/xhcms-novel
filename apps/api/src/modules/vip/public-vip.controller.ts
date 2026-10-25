import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  CoinTransactionItem,
  Paginated,
  RechargeOrder,
  UnlockChapterResult,
  WalletInfo,
} from '@wmcms/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentMember } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/pagination.dto';
import { MemberAuthGuard } from '../../common/guards/member-auth.guard';
import type { AuthMember } from '../../common/types';
import { CreateRechargeOrderDto } from './dto/vip.dto';
import { WalletService } from './wallet.service';

@ApiTags('门户-钱包与VIP')
@Public()
@ApiParam({ name: 'siteSlug', description: '站点 slug' })
@Controller('public/sites/:siteSlug/members')
export class PublicVipController {
  constructor(private readonly wallet: WalletService) {}

  @Get('wallet')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '我的钱包（不存在时自动创建 0 余额）' })
  walletInfo(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
  ): Promise<WalletInfo> {
    return this.wallet.info(siteSlug, member.id);
  }

  @Get('transactions')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '书币流水（分页，按时间倒序）' })
  transactions(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Query() query: PageQueryDto,
  ): Promise<Paginated<CoinTransactionItem>> {
    return this.wallet.transactions(siteSlug, member.id, query);
  }

  @Get('orders')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '我的充值订单（分页，按时间倒序）' })
  orders(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Query() query: PageQueryDto,
  ): Promise<Paginated<RechargeOrder>> {
    return this.wallet.orders(siteSlug, member.id, query);
  }

  @Post('orders')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '创建充值订单（套餐见 RECHARGE_PLANS）' })
  createOrder(
    @Param('siteSlug') siteSlug: string,
    @CurrentMember() member: AuthMember,
    @Body() dto: CreateRechargeOrderDto,
  ): Promise<RechargeOrder> {
    return this.wallet.createOrder(siteSlug, member.id, dto);
  }

  @Post('orders/:orderNo/pay')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '模拟支付订单（置 paid + 加币含赠送 + 写流水；重复支付 400）' })
  payOrder(
    @Param('siteSlug') siteSlug: string,
    @Param('orderNo') orderNo: string,
    @CurrentMember() member: AuthMember,
  ): Promise<{ order: RechargeOrder; balance: number }> {
    return this.wallet.payOrder(siteSlug, member.id, orderNo);
  }

  @Post('chapters/:chapterId/unlock')
  @UseGuards(MemberAuthGuard)
  @ApiOperation({ summary: '解锁付费章节（余额不足 400；已解锁/免费/作者本人幂等）' })
  unlock(
    @Param('siteSlug') siteSlug: string,
    @Param('chapterId') chapterId: string,
    @CurrentMember() member: AuthMember,
  ): Promise<UnlockChapterResult> {
    return this.wallet.unlockChapter(siteSlug, member.id, chapterId);
  }
}
