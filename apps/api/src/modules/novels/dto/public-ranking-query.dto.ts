import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const NOVEL_RANK_TYPES = ['hot', 'new', 'favorite', 'words'] as const;

/** 门户排行榜查询 */
export class PublicRankingQueryDto {
  @ApiPropertyOptional({ description: '榜单类型', enum: NOVEL_RANK_TYPES, default: 'hot' })
  @IsOptional()
  @IsIn(NOVEL_RANK_TYPES, { message: '榜单类型只能为 hot、new、favorite 或 words' })
  type?: (typeof NOVEL_RANK_TYPES)[number] = 'hot';

  @ApiPropertyOptional({ description: '返回数量（最大 50）', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须为整数' })
  @Min(1, { message: 'limit 最小为 1' })
  @Max(50, { message: 'limit 最大为 50' })
  limit?: number = 20;
}
