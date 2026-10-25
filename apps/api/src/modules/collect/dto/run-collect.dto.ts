import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** 正式采集入参（对应 shared 的 CollectRunInput） */
export class RunCollectDto {
  @ApiProperty({ description: '书源 ID' })
  @IsString({ message: '书源 ID 必须为字符串' })
  @IsNotEmpty({ message: '书源 ID 不能为空' })
  sourceId!: string;

  @ApiPropertyOptional({ description: '书籍页地址；缺省使用书源 baseUrl' })
  @IsOptional()
  @IsString({ message: '书籍页地址必须为字符串' })
  @MaxLength(500, { message: '书籍页地址不能超过 500 个字符' })
  @Matches(/^https?:\/\/.+/i, { message: '书籍页地址必须以 http:// 或 https:// 开头' })
  bookUrl?: string;

  @ApiPropertyOptional({ description: '已存在书籍 ID：向其追加章节（不新建书籍）' })
  @IsOptional()
  @IsString({ message: '书籍 ID 必须为字符串' })
  novelId?: string;

  @ApiPropertyOptional({ description: '最多采集章节数（默认 20，最大 100）', example: 20 })
  @IsOptional()
  @IsInt({ message: '采集章节数必须为整数' })
  @Min(1, { message: '采集章节数最小为 1' })
  @Max(100, { message: '采集章节数最大为 100' })
  limit?: number;
}
