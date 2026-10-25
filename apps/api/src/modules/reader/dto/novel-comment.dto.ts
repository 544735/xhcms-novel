import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { CommentStatus } from '@wmcms/shared';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

const COMMENT_STATUSES: CommentStatus[] = ['pending', 'approved', 'rejected'];

/** POST /public/sites/:slug/novel-comments */
export class CreateNovelCommentDto {
  @ApiProperty({ description: '书籍 ID' })
  @IsString({ message: 'novelId 必须为字符串' })
  @MaxLength(64, { message: 'novelId 过长' })
  novelId!: string;

  @ApiPropertyOptional({ description: '章节 ID（章评时传）' })
  @IsOptional()
  @IsString({ message: 'chapterId 必须为字符串' })
  @MaxLength(64, { message: 'chapterId 过长' })
  chapterId?: string;

  @ApiPropertyOptional({ description: '父评论 ID（回复场景）' })
  @IsOptional()
  @IsString({ message: 'parentId 必须为字符串' })
  @MaxLength(64, { message: 'parentId 过长' })
  parentId?: string;

  @ApiProperty({ description: '评论内容（纯文本，入库前清洗）' })
  @IsString({ message: '评论内容必须为字符串' })
  @MinLength(1, { message: '评论内容不能为空' })
  @MaxLength(2000, { message: '评论内容最多 2000 个字符' })
  content!: string;

  @ApiPropertyOptional({ description: '匿名昵称（未登录时可选，默认「匿名读者」）' })
  @IsOptional()
  @IsString({ message: '昵称必须为字符串' })
  @MaxLength(30, { message: '昵称最多 30 个字符' })
  nickname?: string;
}

/** GET /public/sites/:slug/novel-comments */
export class PublicNovelCommentQueryDto {
  @ApiProperty({ description: '书籍 ID' })
  @IsString({ message: 'novelId 必须为字符串' })
  @MaxLength(64, { message: 'novelId 过长' })
  novelId!: string;

  @ApiPropertyOptional({ description: '章节 ID（只看章评）' })
  @IsOptional()
  @IsString({ message: 'chapterId 必须为字符串' })
  @MaxLength(64, { message: 'chapterId 过长' })
  chapterId?: string;

  @ApiPropertyOptional({ description: '根评论页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页根评论数', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize?: number = 20;
}

/** GET /novel-comments（管理端） */
export class QueryNovelCommentDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '按审核状态筛选', enum: COMMENT_STATUSES })
  @IsOptional()
  @IsIn(COMMENT_STATUSES, { message: '评论状态不合法' })
  status?: CommentStatus;

  @ApiPropertyOptional({ description: '按书籍 ID 筛选' })
  @IsOptional()
  @IsString({ message: 'novelId 必须为字符串' })
  novelId?: string;

  @ApiPropertyOptional({ description: '按章节 ID 筛选' })
  @IsOptional()
  @IsString({ message: 'chapterId 必须为字符串' })
  chapterId?: string;
}

/** PATCH /novel-comments/:id/status（管理端审核） */
export class UpdateNovelCommentStatusDto {
  @ApiProperty({ description: '审核结果', enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'], { message: '审核状态只能为 approved 或 rejected' })
  status!: 'approved' | 'rejected';
}
