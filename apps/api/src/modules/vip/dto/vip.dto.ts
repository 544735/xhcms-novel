import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  CoinTransactionType,
  OrderStatus,
} from '@wmcms/shared';
import { RECHARGE_PLANS } from '@wmcms/shared';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

const PLAN_IDS = RECHARGE_PLANS.map((plan) => plan.id);
const ORDER_STATUSES: OrderStatus[] = ['pending', 'paid', 'cancelled'];
const TRANSACTION_TYPES: CoinTransactionType[] = ['recharge', 'consume', 'refund', 'reward'];

/** POST /public/sites/:slug/members/orders */
export class CreateRechargeOrderDto {
  @ApiProperty({
    description: '充值套餐 ID（见 shared RECHARGE_PLANS）',
    enum: PLAN_IDS,
    example: 'plan-600',
  })
  @IsIn(PLAN_IDS, { message: '充值套餐不存在' })
  planId!: string;
}

/** GET /vip/orders */
export class QueryVipOrderDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '订单状态筛选', enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: '订单状态不合法' })
  status?: OrderStatus;
}

/** GET /vip/unlocks */
export class QueryVipUnlockDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '按会员 ID 筛选' })
  @IsOptional()
  @IsString({ message: 'memberId 必须为字符串' })
  memberId?: string;

  @ApiPropertyOptional({ description: '按书籍 ID 筛选' })
  @IsOptional()
  @IsString({ message: 'novelId 必须为字符串' })
  novelId?: string;
}

/** GET /vip/transactions */
export class QueryVipTransactionDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '流水类型筛选', enum: TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(TRANSACTION_TYPES, { message: '流水类型不合法' })
  type?: CoinTransactionType;

  @ApiPropertyOptional({ description: '按会员 ID 筛选' })
  @IsOptional()
  @IsString({ message: 'memberId 必须为字符串' })
  memberId?: string;
}

/** POST /vip/credit（正负均可，调整后余额不得为负） */
export class CreditWalletDto {
  @ApiProperty({ description: '会员 ID' })
  @IsString({ message: 'memberId 必须为字符串' })
  @MaxLength(64, { message: 'memberId 过长' })
  memberId!: string;

  @ApiProperty({ description: '调整书币数（正数增加 / 负数扣减）', example: 100 })
  @Type(() => Number)
  @IsInt({ message: 'amount 必须为整数书币' })
  @Min(-1_000_000, { message: '单次扣减不能超过 100 万书币' })
  amount!: number;

  @ApiPropertyOptional({ description: '调整备注（写入流水）' })
  @IsOptional()
  @IsString({ message: '备注必须为字符串' })
  @MaxLength(200, { message: '备注最多 200 个字符' })
  remark?: string;
}
