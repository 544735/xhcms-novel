import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';
import { ARTICLE_STATUSES } from './create-article.dto';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/** 管理端文章列表查询 */
export class QueryArticleDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '栏目 ID' })
  @IsOptional()
  @IsString({ message: '栏目 ID 必须为字符串' })
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签 ID' })
  @IsOptional()
  @IsString({ message: '标签 ID 必须为字符串' })
  tagId?: string;

  @ApiPropertyOptional({ description: '文章状态', enum: ARTICLE_STATUSES })
  @IsOptional()
  @IsIn(ARTICLE_STATUSES, { message: '文章状态不合法' })
  status?: (typeof ARTICLE_STATUSES)[number];

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isTop 必须为布尔值' })
  isTop?: boolean;

  @ApiPropertyOptional({ description: '是否推荐' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isRecommend 必须为布尔值' })
  isRecommend?: boolean;

  @ApiPropertyOptional({ description: '作者 ID' })
  @IsOptional()
  @IsString({ message: '作者 ID 必须为字符串' })
  authorId?: string;

  @ApiPropertyOptional({
    description: '排序字段',
    enum: ['createdAt', 'updatedAt', 'publishedAt', 'views', 'sort'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'publishedAt', 'views', 'sort'], { message: '排序字段不合法' })
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'views' | 'sort';

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: '排序方向只能为 asc 或 desc' })
  order?: 'asc' | 'desc';
}
