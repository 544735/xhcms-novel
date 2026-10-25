import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const CHAPTER_STATUSES = ['draft', 'published'] as const;

/** 新建章节入参（对应 shared 的 ChapterInput；chapterNo 由服务端取 max+1） */
export class CreateChapterDto {
  @ApiProperty({ description: '所属书籍 ID' })
  @IsString({ message: '书籍 ID 必须为字符串' })
  @IsNotEmpty({ message: '书籍 ID 不能为空' })
  novelId!: string;

  @ApiProperty({ description: '章节标题', example: '第1章 风起' })
  @IsString({ message: '章节标题必须为字符串' })
  @IsNotEmpty({ message: '章节标题不能为空' })
  @MaxLength(200, { message: '章节标题不能超过 200 个字符' })
  title!: string;

  @ApiProperty({ description: '章节正文（HTML 会被转为纯文本）' })
  @IsString({ message: '章节正文必须为字符串' })
  content!: string;

  @ApiPropertyOptional({ description: '所属分卷 ID', nullable: true })
  @IsOptional()
  @IsString({ message: '分卷 ID 必须为字符串' })
  volumeId?: string | null;

  @ApiPropertyOptional({ description: '是否 VIP 收费章节' })
  @IsOptional()
  @IsBoolean({ message: 'isVip 必须为布尔值' })
  isVip?: boolean;

  @ApiPropertyOptional({ description: '阅读本章所需书币（isVip=true 时至少为 1）' })
  @IsOptional()
  @IsInt({ message: '章节价格必须为整数' })
  @Min(0, { message: '章节价格不能为负数' })
  price?: number;

  @ApiPropertyOptional({ description: '章节状态', enum: CHAPTER_STATUSES })
  @IsOptional()
  @IsIn(CHAPTER_STATUSES, { message: '章节状态只能为 draft 或 published' })
  status?: (typeof CHAPTER_STATUSES)[number];
}
