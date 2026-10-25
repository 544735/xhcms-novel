import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

export class QueryAuditLogDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '操作人 ID 精确筛选' })
  @IsOptional()
  @IsString({ message: 'userId 必须为字符串' })
  @MaxLength(64, { message: 'userId 长度不能超过 64 个字符' })
  userId?: string;

  @ApiPropertyOptional({ description: '动作模糊筛选，如 auth.login' })
  @IsOptional()
  @IsString({ message: 'action 必须为字符串' })
  @MaxLength(100, { message: 'action 长度不能超过 100 个字符' })
  action?: string;

  @ApiPropertyOptional({ description: '资源模糊筛选，如 article' })
  @IsOptional()
  @IsString({ message: 'resource 必须为字符串' })
  @MaxLength(64, { message: 'resource 长度不能超过 64 个字符' })
  resource?: string;

  @ApiPropertyOptional({ description: '起始时间（ISO-8601，含）', example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'from 必须为 ISO-8601 日期字符串' })
  from?: string;

  @ApiPropertyOptional({ description: '结束时间（ISO-8601，含）', example: '2026-10-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString({}, { message: 'to 必须为 ISO-8601 日期字符串' })
  to?: string;
}
