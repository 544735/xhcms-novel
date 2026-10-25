import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** 新建栏目入参（对应 shared 的 CategoryInput） */
export class CreateCategoryDto {
  @ApiPropertyOptional({ description: '父栏目 ID；为空表示顶级栏目', nullable: true })
  @IsOptional()
  @IsString({ message: '父栏目 ID 必须为字符串' })
  parentId?: string | null;

  @ApiProperty({ description: '栏目名称', example: '技术动态' })
  @IsString({ message: '栏目名称必须为字符串' })
  @IsNotEmpty({ message: '栏目名称不能为空' })
  @MaxLength(60, { message: '栏目名称不能超过 60 个字符' })
  name!: string;

  @ApiPropertyOptional({ description: '栏目 slug（缺省由名称生成，同站点唯一）', example: 'tech-news' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @MaxLength(80, { message: 'slug 不能超过 80 个字符' })
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'slug 只能包含小写字母、数字与连字符，且不能以连字符开头',
  })
  slug?: string;

  @ApiPropertyOptional({
    description: '栏目类型（novel 用于小说分类，文章数统计改为书籍数）',
    enum: ['article', 'page', 'novel'],
    example: 'article',
  })
  @IsOptional()
  @IsIn(['article', 'page', 'novel'], { message: '栏目类型只能为 article、page 或 novel' })
  type?: 'article' | 'page' | 'novel';

  @ApiPropertyOptional({ description: '栏目描述' })
  @IsOptional()
  @IsString({ message: '栏目描述必须为字符串' })
  @MaxLength(500, { message: '栏目描述不能超过 500 个字符' })
  description?: string;

  @ApiPropertyOptional({ description: '栏目图标（图标名或图片地址）' })
  @IsOptional()
  @IsString({ message: '栏目图标必须为字符串' })
  @MaxLength(200, { message: '栏目图标过长' })
  icon?: string;

  @ApiPropertyOptional({ description: '排序值（升序）', example: 1 })
  @IsOptional()
  @IsInt({ message: '排序值必须为整数' })
  @Min(0, { message: '排序值不能为负数' })
  sort?: number;

  @ApiPropertyOptional({ description: '栏目状态', enum: ['enabled', 'disabled'] })
  @IsOptional()
  @IsIn(['enabled', 'disabled'], { message: '栏目状态只能为 enabled 或 disabled' })
  status?: 'enabled' | 'disabled';

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

  @ApiPropertyOptional({ description: '单页正文（page 类型栏目使用，富文本）' })
  @IsOptional()
  @IsString({ message: '栏目正文必须为字符串' })
  content?: string;

  @ApiPropertyOptional({ description: '栏目模板标识' })
  @IsOptional()
  @IsString({ message: '栏目模板必须为字符串' })
  @MaxLength(120, { message: '栏目模板标识过长' })
  template?: string;
}
