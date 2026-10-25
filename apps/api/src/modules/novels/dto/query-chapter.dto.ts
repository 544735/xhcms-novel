import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';
import { CHAPTER_STATUSES } from './create-chapter.dto';

/**
 * 管理端章节列表查询（novelId 必填）。
 * 关键词 keyword 继承自 PageQueryDto，服务端按 title contains 过滤。
 */
export class QueryChapterDto extends PageQueryDto {
  @ApiProperty({ description: '所属书籍 ID（必填）' })
  @IsString({ message: '书籍 ID 必须为字符串' })
  @IsNotEmpty({ message: '请先选择书籍（novelId 必填）' })
  novelId!: string;

  @ApiPropertyOptional({ description: '章节状态', enum: CHAPTER_STATUSES })
  @IsOptional()
  @IsIn(CHAPTER_STATUSES, { message: '章节状态只能为 draft 或 published' })
  status?: (typeof CHAPTER_STATUSES)[number];

  @ApiPropertyOptional({ description: '分卷 ID' })
  @IsOptional()
  @IsString({ message: '分卷 ID 必须为字符串' })
  volumeId?: string;
}
