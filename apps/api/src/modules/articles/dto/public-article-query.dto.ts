import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

/** 门户文章列表查询（对应 shared 的 PublicSiteQuery） */
export class PublicArticleQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '栏目 slug' })
  @IsOptional()
  @IsString({ message: '栏目 slug 必须为字符串' })
  @MaxLength(80, { message: '栏目 slug 过长' })
  categorySlug?: string;

  @ApiPropertyOptional({ description: '标签 slug' })
  @IsOptional()
  @IsString({ message: '标签 slug 必须为字符串' })
  @MaxLength(80, { message: '标签 slug 过长' })
  tagSlug?: string;

  @ApiPropertyOptional({ description: '仅返回推荐/置顶内容' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'featured 必须为布尔值' })
  featured?: boolean;

  @ApiPropertyOptional({ description: '排序方式', enum: ['latest', 'hot'] })
  @IsOptional()
  @IsIn(['latest', 'hot'], { message: '排序方式只能为 latest 或 hot' })
  sort?: 'latest' | 'hot';
}
