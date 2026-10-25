import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ description: '目标状态', enum: ['active', 'disabled'] })
  @IsIn(['active', 'disabled'], { message: '账号状态只能为 active 或 disabled' })
  status: 'active' | 'disabled';
}
