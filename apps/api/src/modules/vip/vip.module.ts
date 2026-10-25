import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { VipAdminService } from './vip-admin.service';
import { NovelDashboardService } from './novel-dashboard.service';
import { PublicVipController } from './public-vip.controller';
import { VipAdminController } from './vip-admin.controller';
import { NovelDashboardController } from './novel-dashboard.controller';

/**
 * VIP 域：钱包/书币流水、充值订单与模拟支付、章节解锁、
 * 管理端订单/解锁/流水/人工调币，以及小说站仪表盘统计。
 */
@Module({
  controllers: [PublicVipController, VipAdminController, NovelDashboardController],
  providers: [WalletService, VipAdminService, NovelDashboardService],
  exports: [WalletService, VipAdminService, NovelDashboardService],
})
export class VipModule {}
