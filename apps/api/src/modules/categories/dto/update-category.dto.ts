import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/** 更新栏目入参：所有字段可选 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
