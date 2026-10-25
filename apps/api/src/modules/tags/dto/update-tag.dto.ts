import { PartialType } from '@nestjs/swagger';
import { CreateTagDto } from './create-tag.dto';

/** 更新标签入参 */
export class UpdateTagDto extends PartialType(CreateTagDto) {}
