import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import type { PageQuery, Paginated } from '@wmcms/shared';

/** 通用分页查询参数（所有列表接口继承或复用） */
export class PageQueryDto implements PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

export interface NormalizedPage {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function normalizePage(query: PageQuery): NormalizedPage {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize) || 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return { items, total, page, pageSize };
}

export class SortQueryDto {
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
