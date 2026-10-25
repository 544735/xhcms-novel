import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { MemberStatus } from '@wmcms/shared';

const MEMBER_STATUSES: MemberStatus[] = ['active', 'disabled'];

/** 管理端新建会员 */
export class CreateMemberDto {
  @ApiProperty({ description: '用户名（同站点唯一）', example: 'alice' })
  @IsString({ message: '用户名必须为字符串' })
  @MinLength(2, { message: '用户名至少 2 个字符' })
  @MaxLength(30, { message: '用户名最多 30 个字符' })
  username!: string;

  @ApiProperty({ description: '邮箱（同站点唯一）', example: 'alice@example.com' })
  @IsString({ message: '邮箱必须为字符串' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(120, { message: '邮箱最多 120 个字符' })
  email!: string;

  @ApiProperty({ description: '登录密码（至少 8 位）', example: 'Member@123456' })
  @IsString({ message: '密码必须为字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string;

  @ApiPropertyOptional({ description: '昵称', example: 'Alice' })
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(30, { message: '昵称最多 30 个字符' })
  nickname?: string;

  @ApiPropertyOptional({ description: '头像地址' })
  @IsOptional()
  @IsString({ message: '头像必须为字符串' })
  @MaxLength(500, { message: '头像地址最多 500 个字符' })
  avatar?: string;

  @ApiPropertyOptional({ description: '状态', enum: MEMBER_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(MEMBER_STATUSES, { message: '状态只能为 active 或 disabled' })
  status?: MemberStatus;

  @ApiPropertyOptional({ description: '积分', default: 0 })
  @IsOptional()
  @IsInt({ message: '积分必须为整数' })
  @Min(0, { message: '积分不能为负数' })
  points?: number;
}
