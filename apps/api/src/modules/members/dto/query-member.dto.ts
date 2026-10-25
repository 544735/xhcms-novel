import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { MemberStatus } from '@wmcms/shared';
import { PageQueryDto } from '../../../common/dto/pagination.dto';

const MEMBER_STATUSES: MemberStatus[] = ['active', 'disabled'];

export class QueryMemberDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '按状态筛选', enum: MEMBER_STATUSES })
  @IsOptional()
  @IsIn(MEMBER_STATUSES, { message: '状态只能为 active 或 disabled' })
  status?: MemberStatus;
}
