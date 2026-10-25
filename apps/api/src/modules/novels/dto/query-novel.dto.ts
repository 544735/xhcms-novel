import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';
import { NOVEL_AUDIT_STATUSES, NOVEL_STATUSES } from './create-novel.dto';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/** 管理端书籍列表查询 */
export class QueryNovelDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @IsString({ message: '分类 ID 必须为字符串' })
  categoryId?: string;

  @ApiPropertyOptional({ description: '连载状态', enum: NOVEL_STATUSES })
  @IsOptional()
  @IsIn(NOVEL_STATUSES, { message: '连载状态只能为 serial 或 completed' })
  status?: (typeof NOVEL_STATUSES)[number];

  @ApiPropertyOptional({ description: '审核状态', enum: NOVEL_AUDIT_STATUSES })
  @IsOptional()
  @IsIn(NOVEL_AUDIT_STATUSES, { message: '书籍审核状态不合法' })
  auditStatus?: (typeof NOVEL_AUDIT_STATUSES)[number];

  @ApiPropertyOptional({ description: '是否推荐' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isRecommend 必须为布尔值' })
  isRecommend?: boolean;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isTop 必须为布尔值' })
  isTop?: boolean;

  @ApiPropertyOptional({ description: '作者会员 ID' })
  @IsOptional()
  @IsString({ message: '作者会员 ID 必须为字符串' })
  authorId?: string;

  @ApiPropertyOptional({
    description: '排序字段',
    enum: ['updatedAt', 'createdAt', 'views', 'favorites', 'words'],
  })
  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'views', 'favorites', 'words'], {
    message: '排序字段不合法',
  })
  sortBy?: 'updatedAt' | 'createdAt' | 'views' | 'favorites' | 'words';

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: '排序方向只能为 asc 或 desc' })
  order?: 'asc' | 'desc';
}
