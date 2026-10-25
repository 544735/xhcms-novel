import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

/** 门户搜索查询（书名/作者/简介） */
export class PublicNovelSearchQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词', example: '星河' })
  @IsOptional()
  @IsString({ message: '搜索关键词必须为字符串' })
  @MaxLength(100, { message: '搜索关键词不能超过 100 个字符' })
  q?: string;
}
