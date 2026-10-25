import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const NOVEL_REVIEW_STATUSES = ['published', 'rejected', 'offline'] as const;

/** 书籍审核/上下架入参 */
export class ReviewNovelDto {
  @ApiProperty({ description: '目标状态', enum: NOVEL_REVIEW_STATUSES })
  @IsNotEmpty({ message: '审核状态不能为空' })
  @IsIn(NOVEL_REVIEW_STATUSES, { message: '审核状态只能为 published、rejected 或 offline' })
  auditStatus!: (typeof NOVEL_REVIEW_STATUSES)[number];

  @ApiPropertyOptional({ description: '审核备注（驳回/下架原因）' })
  @IsOptional()
  @IsString({ message: '审核备注必须为字符串' })
  @MaxLength(500, { message: '审核备注不能超过 500 个字符' })
  reason?: string;
}
