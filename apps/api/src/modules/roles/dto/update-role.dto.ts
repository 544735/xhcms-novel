import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: '角色名称' })
  @IsOptional()
  @IsString({ message: '角色名称必须为字符串' })
  @MinLength(2, { message: '角色名称长度至少 2 个字符' })
  @MaxLength(30, { message: '角色名称长度不能超过 30 个字符' })
  name?: string;

  @ApiPropertyOptional({ description: '角色编码（仅用于校验：传不同值会被拒绝）' })
  @IsOptional()
  @IsString({ message: '角色编码必须为字符串' })
  @MinLength(2, { message: '角色编码长度至少 2 个字符' })
  @MaxLength(40, { message: '角色编码长度不能超过 40 个字符' })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: '角色编码需以小写字母开头，只能包含小写字母、数字和下划线',
  })
  code?: string;

  @ApiPropertyOptional({ description: '角色描述' })
  @IsOptional()
  @IsString({ message: '角色描述必须为字符串' })
  @MaxLength(200, { message: '角色描述长度不能超过 200 个字符' })
  description?: string | null;

  @ApiPropertyOptional({ description: '权限编码列表（全量替换）', type: [String] })
  @IsOptional()
  @IsArray({ message: 'permissionCodes 必须为数组' })
  @IsString({ each: true, message: '权限编码必须为字符串' })
  permissionCodes?: string[];
}
