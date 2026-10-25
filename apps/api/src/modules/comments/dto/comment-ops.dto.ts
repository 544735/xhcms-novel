import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** 管理端审核：仅允许通过 / 拒绝 */
export class UpdateCommentStatusDto {
  @ApiProperty({ description: '审核结果', enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'], { message: '审核状态只能为 approved 或 rejected' })
  status!: 'approved' | 'rejected';
}

/** 管理端批量操作 */
export class BatchCommentsDto {
  @ApiProperty({ description: '目标评论 ID 列表', type: [String] })
  @IsArray({ message: 'ids 必须为数组' })
  @ArrayNotEmpty({ message: '请选择要操作的评论' })
  @ArrayMaxSize(200, { message: '单次最多操作 200 条评论' })
  @IsString({ each: true, message: '评论 ID 必须为字符串' })
  ids!: string[];

  @ApiProperty({ description: '批量动作', enum: ['approve', 'reject', 'delete'] })
  @IsIn(['approve', 'reject', 'delete'], { message: '批量动作只能为 approve / reject / delete' })
  action!: 'approve' | 'reject' | 'delete';
}

/** 门户提交评论（匿名或会员，昵称在匿名时必填） */
export class CreatePublicCommentDto {
  @ApiPropertyOptional({ description: '昵称（匿名时必填，≤30 字）' })
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(30, { message: '昵称最多 30 个字符' })
  nickname?: string;

  @ApiPropertyOptional({ description: '邮箱（可选，用于接收回复通知）' })
  @IsOptional()
  @IsString({ message: '邮箱必须为字符串' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(120, { message: '邮箱最多 120 个字符' })
  email?: string;

  @ApiProperty({ description: '评论正文（纯文本，入库前清洗）' })
  @IsString({ message: '评论内容必须为字符串' })
  @MinLength(1, { message: '评论内容不能为空' })
  @MaxLength(2000, { message: '评论内容最多 2000 个字符' })
  content!: string;

  @ApiPropertyOptional({ description: '父评论 ID（回复场景）' })
  @IsOptional()
  @IsString({ message: '父评论 ID 必须为字符串' })
  parentId?: string;
}
