import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/** 插件启停 / 配置更新 */
export class UpdatePluginDto {
  @ApiPropertyOptional({ description: '是否启用（更新后立即热生效）' })
  @IsOptional()
  @IsBoolean({ message: 'enabled 必须为布尔值' })
  enabled?: boolean;

  @ApiPropertyOptional({ description: '插件配置（与现有配置浅合并）', type: Object })
  @IsOptional()
  @IsObject({ message: 'config 必须为对象' })
  config?: Record<string, unknown>;
}
