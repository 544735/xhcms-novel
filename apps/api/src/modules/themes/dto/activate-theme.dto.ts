import { ApiProperty } from '@nestjs/swagger';
import { THEME_KEYS } from '@wmcms/shared';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

/** 切换站点主题 */
export class ActivateThemeDto {
  @ApiProperty({ description: '目标站点 ID' })
  @IsString({ message: '站点 ID 必须为字符串' })
  @IsNotEmpty({ message: '站点 ID 不能为空' })
  siteId!: string;

  @ApiProperty({ description: '主题标识', enum: THEME_KEYS, example: 'modern' })
  @IsString({ message: '主题标识必须为字符串' })
  @IsIn(THEME_KEYS, { message: '主题标识不合法' })
  themeKey!: string;
}
