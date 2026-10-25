import { ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from '../../../common/dto/pagination.dto';
import { IsIn, IsOptional } from 'class-validator';

/** 站点列表查询 */
export class QuerySiteDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '站点状态', enum: ['enabled', 'disabled'] })
  @IsOptional()
  @IsIn(['enabled', 'disabled'], { message: '站点状态只能为 enabled 或 disabled' })
  status?: 'enabled' | 'disabled';
}
