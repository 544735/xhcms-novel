import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** 单个设置项（key + value + group） */
export class SettingItemDto {
  @ApiProperty({ description: '设置项 key', example: 'heroTitle' })
  @IsString({ message: '设置项 key 必须为字符串' })
  @IsNotEmpty({ message: '设置项 key 不能为空' })
  @MaxLength(80, { message: '设置项 key 不能超过 80 个字符' })
  key!: string;

  @ApiPropertyOptional({ description: '设置值（字符串；null 表示清空）', nullable: true })
  @IsOptional()
  @IsString({ message: '设置值必须为字符串' })
  value?: string | null;

  @ApiPropertyOptional({ description: '所属分组，缺省 general', example: 'general' })
  @IsOptional()
  @IsString({ message: '分组名必须为字符串' })
  @MaxLength(40, { message: '分组名不能超过 40 个字符' })
  group?: string;
}

/** 保存设置入参 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: '站点 ID；显式传 null 表示全局设置，缺省则取 X-Site-Id 请求头',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: '站点 ID 必须为字符串' })
  siteId?: string | null;

  @ApiProperty({ description: '设置项列表', type: [SettingItemDto] })
  @IsArray({ message: '设置项必须为数组' })
  @ArrayNotEmpty({ message: '设置项不能为空' })
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  items!: SettingItemDto[];
}
