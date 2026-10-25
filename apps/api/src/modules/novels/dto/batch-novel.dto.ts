import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';

export const NOVEL_BATCH_ACTIONS = [
  'publish',
  'offline',
  'recommend',
  'unrecommend',
  'delete',
] as const;

/** 书籍批量操作入参 */
export class BatchNovelDto {
  @ApiProperty({ description: '书籍 ID 列表', type: [String] })
  @IsArray({ message: 'ids 必须为数组' })
  @ArrayNotEmpty({ message: 'ids 不能为空' })
  @ArrayMaxSize(200, { message: '单次最多批量操作 200 本书籍' })
  @IsString({ each: true, message: 'ids 中的每一项必须为字符串' })
  ids!: string[];

  @ApiProperty({ description: '批量动作', enum: NOVEL_BATCH_ACTIONS })
  @IsIn(NOVEL_BATCH_ACTIONS, { message: '批量动作不合法' })
  action!: (typeof NOVEL_BATCH_ACTIONS)[number];
}
