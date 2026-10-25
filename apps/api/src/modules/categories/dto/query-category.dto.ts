import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/** 栏目列表查询（扁平，不分页） */
export class QueryCategoryDto {
  @ApiPropertyOptional({ description: '栏目类型', enum: ['article', 'page', 'novel'] })
  @IsOptional()
  @IsIn(['article', 'page', 'novel'], { message: '栏目类型只能为 article、page 或 novel' })
  type?: 'article' | 'page' | 'novel';

  @ApiPropertyOptional({ description: '栏目状态', enum: ['enabled', 'disabled'] })
  @IsOptional()
  @IsIn(['enabled', 'disabled'], { message: '栏目状态只能为 enabled 或 disabled' })
  status?: 'enabled' | 'disabled';
}
