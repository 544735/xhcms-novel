import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CollectSelectors } from '@wmcms/shared';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const BOOK_SOURCE_TYPES = ['html', 'json'] as const;

const URL_PATTERN = /^https?:\/\/.+/i;

/** 新建书源入参（对应 shared 的 BookSourceInput） */
export class CreateBookSourceDto {
  @ApiProperty({ description: '书源名称', example: '演示 HTML 书源' })
  @IsString({ message: '书源名称必须为字符串' })
  @IsNotEmpty({ message: '书源名称不能为空' })
  @MaxLength(60, { message: '书源名称不能超过 60 个字符' })
  name!: string;

  @ApiPropertyOptional({ description: '书源类型', enum: BOOK_SOURCE_TYPES, example: 'html' })
  @IsOptional()
  @IsIn(BOOK_SOURCE_TYPES, { message: '书源类型只能为 html 或 json' })
  type?: 'html' | 'json';

  @ApiProperty({ description: '书籍页地址（http/https）', example: 'http://127.0.0.1:4000/api/v1/public/demo/collect/book' })
  @IsString({ message: '书源地址必须为字符串' })
  @IsNotEmpty({ message: '书源地址不能为空' })
  @MaxLength(500, { message: '书源地址不能超过 500 个字符' })
  @Matches(URL_PATTERN, { message: '书源地址必须以 http:// 或 https:// 开头' })
  baseUrl!: string;

  @ApiPropertyOptional({ description: '列表页地址（JSON 模式返回章节列表的接口）', nullable: true })
  @IsOptional()
  @IsString({ message: '列表页地址必须为字符串' })
  @MaxLength(500, { message: '列表页地址不能超过 500 个字符' })
  listUrl?: string | null;

  @ApiPropertyOptional({
    description: '采集选择器/字段映射（JSON 对象，入库为字符串）',
    type: Object,
    example: {
      bookTitle: '.book-title',
      bookAuthor: '.book-author',
      bookCover: '.book-cover',
      bookSummary: '.book-summary',
      chapterLinks: '.chapter-list a',
      chapterTitle: '.chapter-title',
      chapterContent: '.chapter-content',
      linkPrefix: 'http://127.0.0.1:4000',
    },
  })
  @IsOptional()
  @IsObject({ message: '采集选择器必须为 JSON 对象' })
  selectors?: CollectSelectors | null;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean({ message: 'enabled 必须为布尔值' })
  enabled?: boolean;
}
