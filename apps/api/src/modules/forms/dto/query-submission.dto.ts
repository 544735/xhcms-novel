import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

export class QuerySubmissionDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '按已读 / 未读筛选', enum: [true, false] })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean({ message: 'read 必须为布尔值' })
  read?: boolean;
}

export class MarkSubmissionReadDto {
  @ApiPropertyOptional({ description: '已读状态', default: true })
  @IsOptional()
  @IsBoolean({ message: 'read 必须为布尔值' })
  read?: boolean;
}
