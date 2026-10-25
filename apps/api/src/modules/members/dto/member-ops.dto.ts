import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { MemberStatus } from '@wmcms/shared';

const MEMBER_STATUSES: MemberStatus[] = ['active', 'disabled'];

/** 启用 / 禁用会员 */
export class UpdateMemberStatusDto {
  @ApiProperty({ description: '目标状态', enum: MEMBER_STATUSES })
  @IsIn(MEMBER_STATUSES, { message: '状态只能为 active 或 disabled' })
  status!: MemberStatus;
}

/** 重置会员密码（管理员操作） */
export class ResetMemberPasswordDto {
  @ApiProperty({ description: '新密码（至少 8 位）', example: 'Member@123456' })
  @IsString({ message: '密码必须为字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string;
}
