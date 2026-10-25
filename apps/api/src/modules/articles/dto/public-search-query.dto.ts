import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

/** 门户站内搜索查询 */
export class PublicSearchQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词（标题/摘要/正文）' })
  @IsOptional()
  @IsString({ message: '搜索关键词必须为字符串' })
  @MaxLength(100, { message: '搜索关键词不能超过 100 个字符' })
  q?: string;
}
