import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** 新建标签入参（对应 shared 的 TagInput） */
export class CreateTagDto {
  @ApiProperty({ description: '标签名称', example: 'Next.js' })
  @IsString({ message: '标签名称必须为字符串' })
  @IsNotEmpty({ message: '标签名称不能为空' })
  @MaxLength(40, { message: '标签名称不能超过 40 个字符' })
  name!: string;

  @ApiPropertyOptional({ description: '标签 slug（缺省由名称生成，同站点唯一）' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @MaxLength(80, { message: 'slug 不能超过 80 个字符' })
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'slug 只能包含小写字母、数字与连字符，且不能以连字符开头',
  })
  slug?: string;
}
