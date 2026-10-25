import { PartialType } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';

/** 更新站点入参：所有字段可选（Partial<SiteInput>） */
export class UpdateSiteDto extends PartialType(CreateSiteDto) {}
