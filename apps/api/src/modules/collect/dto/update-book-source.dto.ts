import { PartialType } from '@nestjs/swagger';
import { CreateBookSourceDto } from './create-book-source.dto';

/** 更新书源入参：所有字段可选 */
export class UpdateBookSourceDto extends PartialType(CreateBookSourceDto) {}
