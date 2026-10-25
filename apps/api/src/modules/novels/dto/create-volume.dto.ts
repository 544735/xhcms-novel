import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** 新建分卷入参 */
export class CreateVolumeDto {
  @ApiProperty({ description: '分卷标题', example: '第一卷 风起' })
  @IsString({ message: '分卷标题必须为字符串' })
  @IsNotEmpty({ message: '分卷标题不能为空' })
  @MaxLength(100, { message: '分卷标题不能超过 100 个字符' })
  title!: string;

  @ApiPropertyOptional({ description: '排序值（升序）', example: 0 })
  @IsOptional()
  @IsInt({ message: '排序值必须为整数' })
  @Min(0, { message: '排序值不能为负数' })
  sort?: number;
}
