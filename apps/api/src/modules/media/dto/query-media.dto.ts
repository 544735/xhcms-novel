import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

/** 媒体列表查询 */
export class QueryMediaDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'MIME 类型（精确匹配，或 image/* 前缀匹配）' })
  @IsOptional()
  @IsString({ message: 'MIME 类型必须为字符串' })
  @MaxLength(120, { message: 'MIME 类型过长' })
  mimeType?: string;

  @ApiPropertyOptional({ description: '文件夹（yyyyMM 或自定义目录）' })
  @IsOptional()
  @IsString({ message: '文件夹必须为字符串' })
  @MaxLength(80, { message: '文件夹名过长' })
  folder?: string;
}
