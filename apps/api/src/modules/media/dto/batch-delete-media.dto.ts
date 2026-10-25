import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** 批量删除媒体 */
export class BatchDeleteMediaDto {
  @ApiProperty({ description: '媒体 ID 列表', type: [String] })
  @IsArray({ message: '媒体 ID 必须为数组' })
  @ArrayNotEmpty({ message: '请选择要删除的媒体' })
  @ArrayMaxSize(100, { message: '单次最多删除 100 个媒体' })
  @IsString({ each: true, message: '媒体 ID 必须为字符串' })
  ids!: string[];
}
