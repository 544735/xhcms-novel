import { PartialType } from '@nestjs/swagger';
import { CreateMemberDto } from './create-member.dto';

/** 管理端编辑会员（所有字段可选；password 传入即重置） */
export class UpdateMemberDto extends PartialType(CreateMemberDto) {}
