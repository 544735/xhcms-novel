import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { CommentStatus } from '@wmcms/shared';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

const COMMENT_STATUSES: CommentStatus[] = ['pending', 'approved', 'rejected'];

export class QueryCommentDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '按审核状态筛选', enum: COMMENT_STATUSES })
  @IsOptional()
  @IsIn(COMMENT_STATUSES, { message: '评论状态不合法' })
  status?: CommentStatus;

  @ApiPropertyOptional({ description: '按文章 ID 筛选' })
  @IsOptional()
  @IsString({ message: '文章 ID 必须为字符串' })
  articleId?: string;
}
