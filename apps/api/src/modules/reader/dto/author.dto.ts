import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { AuthorStatus, ChapterStatus } from '@wmcms/shared';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

const AUTHOR_STATUSES: AuthorStatus[] = ['pending', 'approved', 'rejected'];
const CHAPTER_STATUSES: ChapterStatus[] = ['draft', 'published'];

/** POST /public/sites/:slug/members/author */
export class ApplyAuthorDto {
  @ApiProperty({ description: '作者笔名（全局唯一）' })
  @IsString({ message: '笔名必须为字符串' })
  @MinLength(1, { message: '笔名不能为空' })
  @MaxLength(30, { message: '笔名最多 30 个字符' })
  penName!: string;

  @ApiPropertyOptional({ description: '作者简介' })
  @IsOptional()
  @IsString({ message: '简介必须为字符串' })
  @MaxLength(500, { message: '简介最多 500 个字符' })
  bio?: string;

  @ApiPropertyOptional({ description: '联系方式（邮箱/QQ/微信）' })
  @IsOptional()
  @IsString({ message: '联系方式必须为字符串' })
  @MaxLength(120, { message: '联系方式最多 120 个字符' })
  contact?: string;
}

/** POST /public/sites/:slug/members/author/novels */
export class CreateAuthorNovelDto {
  @ApiProperty({ description: '书名' })
  @IsString({ message: '书名必须为字符串' })
  @MinLength(1, { message: '书名不能为空' })
  @MaxLength(120, { message: '书名最多 120 个字符' })
  title!: string;

  @ApiPropertyOptional({ description: 'slug（缺省按书名生成）' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @MaxLength(80, { message: 'slug 最多 80 个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @IsString({ message: 'categoryId 必须为字符串' })
  categoryId?: string | null;

  @ApiPropertyOptional({ description: '封面地址' })
  @IsOptional()
  @IsString({ message: '封面必须为字符串' })
  @MaxLength(500, { message: '封面地址过长' })
  cover?: string | null;

  @ApiPropertyOptional({ description: '书籍简介' })
  @IsOptional()
  @IsString({ message: '简介必须为字符串' })
  @MaxLength(2000, { message: '简介最多 2000 个字符' })
  summary?: string | null;

  @ApiPropertyOptional({ description: '连载状态', enum: ['serial', 'completed'] })
  @IsOptional()
  @IsIn(['serial', 'completed'], { message: '连载状态不合法' })
  status?: 'serial' | 'completed';

  @ApiPropertyOptional({ description: '是否整本 VIP' })
  @IsOptional()
  @IsBoolean({ message: 'vipOnly 必须为布尔值' })
  vipOnly?: boolean;

  @ApiPropertyOptional({ description: 'SEO 标题' })
  @IsOptional()
  @IsString({ message: 'SEO 标题必须为字符串' })
  @MaxLength(120, { message: 'SEO 标题最多 120 个字符' })
  seoTitle?: string | null;

  @ApiPropertyOptional({ description: 'SEO 关键词' })
  @IsOptional()
  @IsString({ message: 'SEO 关键词必须为字符串' })
  @MaxLength(200, { message: 'SEO 关键词最多 200 个字符' })
  seoKeywords?: string | null;

  @ApiPropertyOptional({ description: 'SEO 描述' })
  @IsOptional()
  @IsString({ message: 'SEO 描述必须为字符串' })
  @MaxLength(300, { message: 'SEO 描述最多 300 个字符' })
  seoDescription?: string | null;
}

/** PATCH /public/sites/:slug/members/author/novels/:id（不可自行改审核状态/推荐位） */
export class UpdateAuthorNovelDto extends PartialType(CreateAuthorNovelDto) {}

/** GET /public/sites/:slug/members/author/novels */
export class QueryAuthorNovelDto extends PageQueryDto {}

/** POST /public/sites/:slug/members/author/novels/:id/chapters */
export class CreateAuthorChapterDto {
  @ApiProperty({ description: '章节标题' })
  @IsString({ message: '章节标题必须为字符串' })
  @MinLength(1, { message: '章节标题不能为空' })
  @MaxLength(120, { message: '章节标题最多 120 个字符' })
  title!: string;

  @ApiProperty({ description: '章节正文（纯文本可含换行，入库前去标签）' })
  @IsString({ message: '章节正文必须为字符串' })
  @MinLength(1, { message: '章节正文不能为空' })
  content!: string;

  @ApiPropertyOptional({ description: '所属分卷 ID' })
  @IsOptional()
  @IsString({ message: 'volumeId 必须为字符串' })
  volumeId?: string | null;

  @ApiPropertyOptional({ description: '是否付费章节' })
  @IsOptional()
  @IsBoolean({ message: 'isVip 必须为布尔值' })
  isVip?: boolean;

  @ApiPropertyOptional({ description: '阅读所需书币（isVip 为 true 时生效，至少 1）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'price 必须为整数' })
  @Min(0, { message: 'price 不能为负数' })
  @Max(100000, { message: 'price 过大' })
  price?: number;

  @ApiPropertyOptional({ description: '章节状态（书籍未上架时强制 draft）', enum: CHAPTER_STATUSES })
  @IsOptional()
  @IsIn(CHAPTER_STATUSES, { message: '章节状态不合法' })
  status?: ChapterStatus;
}

/** PATCH /public/sites/:slug/members/author/novels/:id/chapters/:chapterId */
export class UpdateAuthorChapterDto extends PartialType(CreateAuthorChapterDto) {}

/** GET /public/sites/:slug/members/author/novels/:id/chapters */
export class QueryAuthorChapterDto extends PageQueryDto {}

/** GET /author-applications（管理端） */
export class QueryAuthorApplicationDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '按申请状态筛选', enum: AUTHOR_STATUSES })
  @IsOptional()
  @IsIn(AUTHOR_STATUSES, { message: '作者申请状态不合法' })
  status?: AuthorStatus;
}

/** POST /author-applications/:id/review（管理端） */
export class ReviewAuthorApplicationDto {
  @ApiProperty({ description: '审核结果', enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'], { message: '审核结果只能为 approved 或 rejected' })
  status!: 'approved' | 'rejected';

  @ApiPropertyOptional({ description: '驳回原因（status=rejected 时建议填写）' })
  @IsOptional()
  @IsString({ message: '驳回原因必须为字符串' })
  @MaxLength(200, { message: '驳回原因最多 200 个字符' })
  reason?: string;
}
