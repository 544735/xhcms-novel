import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export const NOVEL_STATUSES = ['serial', 'completed'] as const;
export const NOVEL_AUDIT_STATUSES = ['pending', 'published', 'rejected', 'offline'] as const;

/** 新建书籍入参（对应 shared 的 NovelInput） */
export class CreateNovelDto {
  @ApiProperty({ description: '书名', example: '星海彼岸' })
  @IsString({ message: '书名必须为字符串' })
  @IsNotEmpty({ message: '书名不能为空' })
  @MaxLength(120, { message: '书名不能超过 120 个字符' })
  title!: string;

  @ApiPropertyOptional({ description: '书籍 slug（缺省由书名生成，同站点唯一）' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @MaxLength(80, { message: 'slug 不能超过 80 个字符' })
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'slug 只能包含小写字母、数字与连字符，且不能以连字符开头',
  })
  slug?: string;

  @ApiProperty({ description: '作者笔名（展示用）', example: '星河散人' })
  @IsString({ message: '作者笔名必须为字符串' })
  @IsNotEmpty({ message: '作者笔名不能为空' })
  @MaxLength(60, { message: '作者笔名不能超过 60 个字符' })
  authorName!: string;

  @ApiPropertyOptional({ description: '分类 ID', nullable: true })
  @IsOptional()
  @IsString({ message: '分类 ID 必须为字符串' })
  categoryId?: string | null;

  @ApiPropertyOptional({ description: '封面地址' })
  @IsOptional()
  @IsString({ message: '封面地址必须为字符串' })
  @MaxLength(500, { message: '封面地址过长' })
  cover?: string | null;

  @ApiPropertyOptional({ description: '书籍简介' })
  @IsOptional()
  @IsString({ message: '书籍简介必须为字符串' })
  @MaxLength(2000, { message: '书籍简介不能超过 2000 个字符' })
  summary?: string | null;

  @ApiPropertyOptional({ description: '连载状态', enum: NOVEL_STATUSES })
  @IsOptional()
  @IsIn(NOVEL_STATUSES, { message: '连载状态只能为 serial 或 completed' })
  status?: (typeof NOVEL_STATUSES)[number];

  @ApiPropertyOptional({ description: '审核/上架状态', enum: NOVEL_AUDIT_STATUSES })
  @IsOptional()
  @IsIn(NOVEL_AUDIT_STATUSES, { message: '书籍审核状态不合法' })
  auditStatus?: (typeof NOVEL_AUDIT_STATUSES)[number];

  @ApiPropertyOptional({ description: '是否推荐' })
  @IsOptional()
  @IsBoolean({ message: 'isRecommend 必须为布尔值' })
  isRecommend?: boolean;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean({ message: 'isTop 必须为布尔值' })
  isTop?: boolean;

  @ApiPropertyOptional({ description: '是否整本 VIP 收费' })
  @IsOptional()
  @IsBoolean({ message: 'vipOnly 必须为布尔值' })
  vipOnly?: boolean;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString({ message: 'SEO 标题必须为字符串' })
  @MaxLength(200, { message: 'SEO 标题不能超过 200 个字符' })
  seoTitle?: string | null;

  @ApiPropertyOptional({ description: 'SEO 关键词（逗号分隔）' })
  @IsOptional()
  @IsString({ message: 'SEO 关键词必须为字符串' })
  @MaxLength(500, { message: 'SEO 关键词过长' })
  seoKeywords?: string | null;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString({ message: 'SEO 描述必须为字符串' })
  @MaxLength(500, { message: 'SEO 描述不能超过 500 个字符' })
  seoDescription?: string | null;

  @ApiPropertyOptional({ description: '关联作者会员 ID（Member.id）', nullable: true })
  @IsOptional()
  @IsString({ message: '作者会员 ID 必须为字符串' })
  authorId?: string | null;
}
