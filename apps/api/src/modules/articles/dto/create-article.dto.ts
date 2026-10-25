import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const ARTICLE_STATUSES = ['draft', 'published', 'scheduled', 'archived'] as const;

/** 新建文章入参（对应 shared 的 ArticleInput） */
export class CreateArticleDto {
  @ApiPropertyOptional({ description: '所属栏目 ID', nullable: true })
  @IsOptional()
  @IsString({ message: '栏目 ID 必须为字符串' })
  categoryId?: string | null;

  @ApiProperty({ description: '文章标题', example: '用 Next.js 15 重构企业官网' })
  @IsString({ message: '文章标题必须为字符串' })
  @IsNotEmpty({ message: '文章标题不能为空' })
  @MaxLength(200, { message: '文章标题不能超过 200 个字符' })
  title!: string;

  @ApiPropertyOptional({ description: '文章 slug（缺省由标题生成，同站点唯一）' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @MaxLength(80, { message: 'slug 不能超过 80 个字符' })
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'slug 只能包含小写字母、数字与连字符，且不能以连字符开头',
  })
  slug?: string;

  @ApiPropertyOptional({ description: '摘要', nullable: true })
  @IsOptional()
  @IsString({ message: '摘要必须为字符串' })
  @MaxLength(500, { message: '摘要不能超过 500 个字符' })
  summary?: string | null;

  @ApiProperty({ description: '正文（HTML，入库前白名单清洗）' })
  @IsString({ message: '正文必须为字符串' })
  @IsNotEmpty({ message: '正文不能为空' })
  content!: string;

  @ApiPropertyOptional({ description: '封面图地址', nullable: true })
  @IsOptional()
  @IsString({ message: '封面图必须为字符串' })
  @MaxLength(500, { message: '封面图地址过长' })
  cover?: string | null;

  @ApiPropertyOptional({ description: '文章状态', enum: ARTICLE_STATUSES, example: 'draft' })
  @IsOptional()
  @IsIn(ARTICLE_STATUSES, { message: '文章状态不合法' })
  status?: (typeof ARTICLE_STATUSES)[number];

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean({ message: 'isTop 必须为布尔值' })
  isTop?: boolean;

  @ApiPropertyOptional({ description: '是否推荐' })
  @IsOptional()
  @IsBoolean({ message: 'isRecommend 必须为布尔值' })
  isRecommend?: boolean;

  @ApiPropertyOptional({ description: '排序值（升序）' })
  @IsOptional()
  @IsInt({ message: '排序值必须为整数' })
  @Min(0, { message: '排序值不能为负数' })
  sort?: number;

  @ApiPropertyOptional({
    description: '发布时间（ISO 字符串）；status=published 且未提供时自动取当前时间',
    nullable: true,
  })
  @IsOptional()
  @IsDateString({}, { message: '发布时间必须为 ISO 日期字符串' })
  publishedAt?: string | null;

  @ApiPropertyOptional({ description: '标签 ID 列表（全量替换）', type: [String] })
  @IsOptional()
  @IsArray({ message: '标签必须为数组' })
  @ArrayMaxSize(50, { message: '单篇文章最多关联 50 个标签' })
  @IsString({ each: true, message: '标签 ID 必须为字符串' })
  tagIds?: string[];

  @ApiPropertyOptional({ description: 'SEO 标题', nullable: true })
  @IsOptional()
  @IsString({ message: 'SEO 标题必须为字符串' })
  @MaxLength(200, { message: 'SEO 标题不能超过 200 个字符' })
  seoTitle?: string | null;

  @ApiPropertyOptional({ description: 'SEO 关键词（逗号分隔）', nullable: true })
  @IsOptional()
  @IsString({ message: 'SEO 关键词必须为字符串' })
  @MaxLength(500, { message: 'SEO 关键词过长' })
  seoKeywords?: string | null;

  @ApiPropertyOptional({ description: 'SEO 描述', nullable: true })
  @IsOptional()
  @IsString({ message: 'SEO 描述必须为字符串' })
  @MaxLength(500, { message: 'SEO 描述不能超过 500 个字符' })
  seoDescription?: string | null;
}
