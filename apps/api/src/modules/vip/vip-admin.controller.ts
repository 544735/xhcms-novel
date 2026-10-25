import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@wmcms/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SiteScoped } from '../../common/decorators/site-scoped.decorator';
import { CurrentSiteId, Req } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequest } from '../../common/types';
import {
  CreditWalletDto,
  QueryVipOrderDto,
  QueryVipTransactionDto,
  QueryVipUnlockDto,
} from './dto/vip.dto';
import {
  AdminOrderItem,
  AdminTransactionItem,
  AdminUnlockItem,
  VipAdminService,
} from './vip-admin.service';

@ApiTags('VIP 管理')
@ApiBearerAuth('admin')
@ApiHeader({ name: 'X-Site-Id', required: true, description: '当前站点 ID' })
@SiteScoped()
@Controller('vip')
export class VipAdminController {
  constructor(private readonly vip: VipAdminService) {}

  @Get('orders')
  @RequirePermissions('vip:view')
  @ApiOperation({ summary: '充值订单列表（分页 + 状态 + 关键字）' })
  orders(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryVipOrderDto,
  ): Promise<Paginated<AdminOrderItem>> {
    return this.vip.listOrders(siteId, query);
  }

  @Get('unlocks')
  @RequirePermissions('vip:view')
  @ApiOperation({ summary: '章节解锁记录（分页 + 会员/书籍筛选）' })
  unlocks(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryVipUnlockDto,
  ): Promise<Paginated<AdminUnlockItem>> {
    return this.vip.listUnlocks(siteId, query);
  }

  @Get('transactions')
  @RequirePermissions('vip:view')
  @ApiOperation({ summary: '书币流水（分页 + 类型/会员筛选）' })
  transactions(
    @CurrentSiteId() siteId: string,
    @Query() query: QueryVipTransactionDto,
  ): Promise<Paginated<AdminTransactionItem>> {
    return this.vip.listTransactions(siteId, query);
  }

  @Post('credit')
  @RequirePermissions('vip:credit')
  @ApiOperation({ summary: '人工调整会员书币（正负均可，余额不得为负）' })
  credit(
    @CurrentSiteId() siteId: string,
    @Body() dto: CreditWalletDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ balance: number }> {
    return this.vip.credit(siteId, dto, req);
  }
}
