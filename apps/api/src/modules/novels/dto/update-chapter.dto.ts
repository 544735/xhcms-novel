import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateChapterDto } from './create-chapter.dto';

/** 更新章节入参：所有字段可选（chapterNo 可显式调整，冲突时报 409） */
export class UpdateChapterDto extends PartialType(CreateChapterDto) {
  @ApiPropertyOptional({ description: '章节序号（缺省保持不变；新增章节取 max+1）' })
  @IsOptional()
  @IsInt({ message: '章节序号必须为整数' })
  @Min(1, { message: '章节序号最小为 1' })
  chapterNo?: number;
}
