import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名称', example: '内容审核员' })
  @IsString({ message: '角色名称必须为字符串' })
  @MinLength(2, { message: '角色名称长度至少 2 个字符' })
  @MaxLength(30, { message: '角色名称长度不能超过 30 个字符' })
  name: string;

  @ApiProperty({ description: '角色编码（唯一，创建后不可修改）', example: 'content_auditor' })
  @IsString({ message: '角色编码必须为字符串' })
  @MinLength(2, { message: '角色编码长度至少 2 个字符' })
  @MaxLength(40, { message: '角色编码长度不能超过 40 个字符' })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: '角色编码需以小写字母开头，只能包含小写字母、数字和下划线',
  })
  code: string;

  @ApiPropertyOptional({ description: '角色描述' })
  @IsOptional()
  @IsString({ message: '角色描述必须为字符串' })
  @MaxLength(200, { message: '角色描述长度不能超过 200 个字符' })
  description?: string | null;

  @ApiProperty({ description: '权限编码列表（全量）', type: [String] })
  @IsArray({ message: 'permissionCodes 必须为数组' })
  @IsString({ each: true, message: '权限编码必须为字符串' })
  permissionCodes: string[];
}
