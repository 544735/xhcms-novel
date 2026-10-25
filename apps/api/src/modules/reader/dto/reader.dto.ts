import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** POST /public/sites/:slug/members/bookshelf */
export class AddBookshelfDto {
  @ApiProperty({ description: '书籍 ID' })
  @IsString({ message: 'novelId 必须为字符串' })
  @MaxLength(64, { message: 'novelId 过长' })
  novelId!: string;
}

/** PUT /public/sites/:slug/members/progress */
export class SaveProgressDto {
  @ApiProperty({ description: '书籍 ID' })
  @IsString({ message: 'novelId 必须为字符串' })
  @MaxLength(64, { message: 'novelId 过长' })
  novelId!: string;

  @ApiProperty({ description: '章节 ID' })
  @IsString({ message: 'chapterId 必须为字符串' })
  @MaxLength(64, { message: 'chapterId 过长' })
  chapterId!: string;

  @ApiProperty({ description: '阅读进度（0-1 小数或 0-100 百分数均可）', example: 0.62 })
  @Type(() => Number)
  @IsNumber({}, { message: 'percent 必须为数字' })
  @Min(0, { message: 'percent 不能小于 0' })
  @Max(100, { message: 'percent 不能大于 100' })
  percent!: number;
}

/** GET /public/sites/:slug/members/history */
export class HistoryQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize?: number = 10;
}
