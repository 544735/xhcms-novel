import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsString } from 'class-validator';
import type { ArticleBatchAction } from '@wmcms/shared';

export const ARTICLE_BATCH_ACTIONS: ArticleBatchAction[] = [
  'publish',
  'unpublish',
  'archive',
  'delete',
  'top',
  'untop',
  'recommend',
  'unrecommend',
];

/** 批量操作文章入参 */
export class BatchArticleDto {
  @ApiProperty({ description: '文章 ID 列表', type: [String] })
  @IsArray({ message: '文章 ID 必须为数组' })
  @ArrayNotEmpty({ message: '请选择要操作的文章' })
  @ArrayMaxSize(200, { message: '单次最多操作 200 篇文章' })
  @IsString({ each: true, message: '文章 ID 必须为字符串' })
  ids!: string[];

  @ApiProperty({ description: '批量动作', enum: ARTICLE_BATCH_ACTIONS })
  @IsIn(ARTICLE_BATCH_ACTIONS, { message: '不支持的批量操作类型' })
  action!: ArticleBatchAction;
}
