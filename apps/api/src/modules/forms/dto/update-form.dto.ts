import { PartialType } from '@nestjs/swagger';
import { CreateFormDto } from './create-form.dto';

/** 管理端编辑表单（字段全可选） */
export class UpdateFormDto extends PartialType(CreateFormDto) {}
