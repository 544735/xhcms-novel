import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** TXT 导入参数（multipart 文本字段） */
export class ImportTxtDto {
  @ApiPropertyOptional({ description: '导入到指定分卷标题（缺省不分卷）', example: '第一卷 风起' })
  @IsOptional()
  @IsString({ message: '分卷标题必须为字符串' })
  @MaxLength(100, { message: '分卷标题不能超过 100 个字符' })
  volumeTitle?: string;

  @ApiPropertyOptional({
    description: '分章正则（缺省 ^第[一二三四五六七八九十百千0-9]+[章节回]）',
    example: '^第[一二三四五六七八九十百千0-9]+[章节回]',
  })
  @IsOptional()
  @IsString({ message: '分章正则必须为字符串' })
  @MaxLength(300, { message: '分章正则过长' })
  pattern?: string;
}
