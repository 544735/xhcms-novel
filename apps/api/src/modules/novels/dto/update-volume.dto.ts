import { PartialType } from '@nestjs/swagger';
import { CreateVolumeDto } from './create-volume.dto';

/** 更新分卷入参：所有字段可选 */
export class UpdateVolumeDto extends PartialType(CreateVolumeDto) {}
