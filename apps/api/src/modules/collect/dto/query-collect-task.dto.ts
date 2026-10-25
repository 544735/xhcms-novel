import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

export const COLLECT_TASK_STATUSES = [
  'pending',
  'running',
  'success',
  'partial',
  'failed',
] as const;

/** 采集任务列表查询 */
export class QueryCollectTaskDto extends PageQueryDto {
  @ApiPropertyOptional({
    description: '任务状态过滤',
    enum: COLLECT_TASK_STATUSES,
  })
  @IsOptional()
  @IsIn(COLLECT_TASK_STATUSES, { message: '任务状态不合法' })
  status?: (typeof COLLECT_TASK_STATUSES)[number];
}
