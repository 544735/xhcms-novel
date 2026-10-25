import { PartialType } from '@nestjs/swagger';
import { CreateNovelDto } from './create-novel.dto';

/** 更新书籍入参：所有字段可选 */
export class UpdateNovelDto extends PartialType(CreateNovelDto) {}
