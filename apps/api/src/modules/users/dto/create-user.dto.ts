import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: '登录账号', example: 'content-editor' })
  @IsString({ message: '账号必须为字符串' })
  @MinLength(3, { message: '账号长度至少 3 个字符' })
  @MaxLength(32, { message: '账号长度不能超过 32 个字符' })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: '账号只能包含字母、数字、下划线和短横线' })
  username: string;

  @ApiProperty({ description: '邮箱', example: 'editor@wmcms.local' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(120, { message: '邮箱长度不能超过 120 个字符' })
  email: string;

  @ApiProperty({ description: '登录密码，至少 8 位', minLength: 8 })
  @IsString({ message: '密码必须为字符串' })
  @MinLength(8, { message: '密码长度至少 8 位' })
  @MaxLength(72, { message: '密码长度不能超过 72 位' })
  password: string;

  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(50, { message: '昵称长度不能超过 50 个字符' })
  nickname?: string | null;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString({ message: '头像必须为字符串' })
  @MaxLength(500, { message: '头像地址长度不能超过 500 个字符' })
  avatar?: string | null;

  @ApiPropertyOptional({ description: '账号状态', enum: ['active', 'disabled'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'disabled'], { message: '账号状态只能为 active 或 disabled' })
  status?: 'active' | 'disabled';

  @ApiPropertyOptional({ description: '是否超级管理员（仅超管可设置）', default: false })
  @IsOptional()
  @IsBoolean({ message: 'isSuperAdmin 必须为布尔值' })
  isSuperAdmin?: boolean;

  @ApiPropertyOptional({ description: '角色 ID 列表（全量）', type: [String] })
  @IsOptional()
  @IsArray({ message: 'roleIds 必须为数组' })
  @IsString({ each: true, message: '角色 ID 必须为字符串' })
  roleIds?: string[];

  @ApiPropertyOptional({ description: '可访问站点 ID 列表（全量）', type: [String] })
  @IsOptional()
  @IsArray({ message: 'siteIds 必须为数组' })
  @IsString({ each: true, message: '站点 ID 必须为字符串' })
  siteIds?: string[];
}
