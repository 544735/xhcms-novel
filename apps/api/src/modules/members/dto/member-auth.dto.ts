import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** 门户会员注册 */
export class RegisterMemberDto {
  @ApiProperty({ description: '用户名（同站点唯一，字母/数字/下划线）', example: 'alice' })
  @IsString({ message: '用户名必须为字符串' })
  @MinLength(2, { message: '用户名至少 2 个字符' })
  @MaxLength(30, { message: '用户名最多 30 个字符' })
  @Matches(/^[a-zA-Z0-9_\u4e00-\u9fa5-]+$/, { message: '用户名只能包含字母、数字、下划线、短横线或中文' })
  username!: string;

  @ApiProperty({ description: '邮箱（同站点唯一）', example: 'alice@example.com' })
  @IsString({ message: '邮箱必须为字符串' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(120, { message: '邮箱最多 120 个字符' })
  email!: string;

  @ApiProperty({ description: '密码（至少 8 位）', example: 'Member@123456' })
  @IsString({ message: '密码必须为字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string;

  @ApiPropertyOptional({ description: '昵称（缺省取用户名）' })
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(30, { message: '昵称最多 30 个字符' })
  nickname?: string;
}

/** 门户会员登录：account 支持用户名或邮箱 */
export class LoginMemberDto {
  @ApiProperty({ description: '用户名或邮箱', example: 'alice' })
  @IsString({ message: '账号必须为字符串' })
  @MinLength(1, { message: '请输入用户名或邮箱' })
  @MaxLength(120, { message: '账号最多 120 个字符' })
  account!: string;

  @ApiProperty({ description: '密码' })
  @IsString({ message: '密码必须为字符串' })
  @MinLength(1, { message: '请输入密码' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string;
}

/** 门户会员资料更新 */
export class UpdateMemberProfileDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(30, { message: '昵称最多 30 个字符' })
  nickname?: string;

  @ApiPropertyOptional({ description: '头像地址' })
  @IsOptional()
  @IsString({ message: '头像必须为字符串' })
  @MaxLength(500, { message: '头像地址最多 500 个字符' })
  avatar?: string;

  @ApiPropertyOptional({ description: '新密码（至少 8 位，传入即修改）' })
  @IsOptional()
  @IsString({ message: '密码必须为字符串' })
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password?: string;
}
