import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/** 阅读章节时前端可上报当前阅读百分比（每 20% 上报一次） */
export class ReadChapterQueryDto {
  @ApiPropertyOptional({ description: '当前阅读进度百分比（0-100）', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'percent 必须为数字' })
  @Min(0, { message: 'percent 不能小于 0' })
  @Max(100, { message: 'percent 不能大于 100' })
  percent?: number;
}
