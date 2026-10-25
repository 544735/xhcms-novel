import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';
import { NOVEL_STATUSES } from './create-novel.dto';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/** 门户书库列表查询 */
export class PublicNovelQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '分类 slug' })
  @IsOptional()
  @IsString({ message: '分类 slug 必须为字符串' })
  @MaxLength(80, { message: '分类 slug 过长' })
  categorySlug?: string;

  @ApiPropertyOptional({ description: '连载状态', enum: NOVEL_STATUSES })
  @IsOptional()
  @IsIn(NOVEL_STATUSES, { message: '连载状态只能为 serial 或 completed' })
  status?: (typeof NOVEL_STATUSES)[number];

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

  @ApiPropertyOptional({ description: '仅推荐书籍' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isRecommend 必须为布尔值' })
  isRecommend?: boolean;

  @ApiPropertyOptional({ description: '仅置顶书籍' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isTop 必须为布尔值' })
  isTop?: boolean;
}
