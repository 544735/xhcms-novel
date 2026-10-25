import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { THEME_KEYS } from '@wmcms/shared';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** 新建站点入参（对应 shared 的 SiteInput） */
export class CreateSiteDto {
  @ApiProperty({ description: '站点名称', example: '科技前沿' })
  @IsString({ message: '站点名称必须为字符串' })
  @IsNotEmpty({ message: '站点名称不能为空' })
  @MaxLength(60, { message: '站点名称不能超过 60 个字符' })
  name!: string;

  @ApiProperty({ description: '站点标识（全局唯一，用于门户路径）', example: 'tech' })
  @IsString({ message: '站点标识必须为字符串' })
  @IsNotEmpty({ message: '站点标识不能为空' })
  @MaxLength(60, { message: '站点标识不能超过 60 个字符' })
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: '站点标识只能包含小写字母、数字与连字符，且不能以连字符开头',
  })
  slug!: string;

  @ApiPropertyOptional({ description: '绑定域名', example: 'tech.localhost' })
  @IsOptional()
  @IsString({ message: '绑定域名必须为字符串' })
  @MaxLength(120, { message: '绑定域名不能超过 120 个字符' })
  domain?: string;

  @ApiPropertyOptional({ description: '主题标识', enum: THEME_KEYS, example: 'modern' })
  @IsOptional()
  @IsIn(THEME_KEYS, { message: '主题标识不合法' })
  themeKey?: string;

  @ApiPropertyOptional({ description: '站点 Logo' })
  @IsOptional()
  @IsString({ message: 'Logo 必须为字符串' })
  @MaxLength(500, { message: 'Logo 地址过长' })
  logo?: string;

  @ApiPropertyOptional({ description: '站点描述' })
  @IsOptional()
  @IsString({ message: '站点描述必须为字符串' })
  @MaxLength(500, { message: '站点描述不能超过 500 个字符' })
  description?: string;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString({ message: 'SEO 标题必须为字符串' })
  @MaxLength(200, { message: 'SEO 标题不能超过 200 个字符' })
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO 关键词（逗号分隔）' })
  @IsOptional()
  @IsString({ message: 'SEO 关键词必须为字符串' })
  @MaxLength(500, { message: 'SEO 关键词过长' })
  seoKeywords?: string;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString({ message: 'SEO 描述必须为字符串' })
  @MaxLength(500, { message: 'SEO 描述不能超过 500 个字符' })
  seoDescription?: string;

  @ApiPropertyOptional({ description: '站点状态', enum: ['enabled', 'disabled'], example: 'enabled' })
  @IsOptional()
  @IsIn(['enabled', 'disabled'], { message: '站点状态只能为 enabled 或 disabled' })
  status?: 'enabled' | 'disabled';

  @ApiPropertyOptional({ description: '站点扩展配置（JSON 对象）', type: Object })
  @IsOptional()
  @IsObject({ message: '站点配置必须为 JSON 对象' })
  settings?: Record<string, unknown>;
}
