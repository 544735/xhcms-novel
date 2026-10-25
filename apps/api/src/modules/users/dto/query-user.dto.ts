import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

export class QueryUserDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '账号状态筛选', enum: ['active', 'disabled'] })
  @IsOptional()
  @IsIn(['active', 'disabled'], { message: '账号状态只能为 active 或 disabled' })
  status?: 'active' | 'disabled';
}
