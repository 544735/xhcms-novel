import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { FormField } from '@wmcms/shared';

/** 表单字段允许的类型（与共享契约 FormField.type 一致） */
export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'tel',
  'number',
  'select',
  'radio',
  'checkbox',
  'date',
] as const;

export class FormFieldDto implements FormField {
  @ApiProperty({ description: '字段 key（站点内表单内唯一，字母开头）', example: 'email' })
  @IsString({ message: '字段 key 必须为字符串' })
  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
    message: '字段 key 只能包含字母、数字与下划线，且必须以字母开头',
  })
  @MaxLength(40, { message: '字段 key 最多 40 个字符' })
  key!: string;

  @ApiProperty({ description: '字段标签', example: '邮箱' })
  @IsString({ message: '字段标签必须为字符串' })
  @MinLength(1, { message: '字段标签不能为空' })
  @MaxLength(60, { message: '字段标签最多 60 个字符' })
  label!: string;

  @ApiProperty({ description: '字段类型', enum: FORM_FIELD_TYPES })
  @IsIn(FORM_FIELD_TYPES as unknown as string[], { message: '字段类型不合法' })
  type!: FormField['type'];

  @ApiPropertyOptional({ description: '是否必填', default: false })
  @IsOptional()
  @IsBoolean({ message: 'required 必须为布尔值' })
  required?: boolean;

  @ApiPropertyOptional({ description: '占位提示' })
  @IsOptional()
  @IsString({ message: '占位提示必须为字符串' })
  @MaxLength(120, { message: '占位提示最多 120 个字符' })
  placeholder?: string;

  @ApiPropertyOptional({ description: '选项（select / radio / checkbox 必填）', type: [String] })
  @IsOptional()
  @IsArray({ message: 'options 必须为数组' })
  @ArrayMaxSize(50, { message: '选项最多 50 个' })
  @IsString({ each: true, message: '选项必须为字符串' })
  options?: string[];

  @ApiPropertyOptional({ description: '最大长度（文本类字段）' })
  @IsOptional()
  @IsInt({ message: 'maxLength 必须为整数' })
  @Min(1, { message: 'maxLength 最小为 1' })
  maxLength?: number;
}

/** 管理端新建表单 */
export class CreateFormDto {
  @ApiProperty({ description: '表单名称', example: '联系我们' })
  @IsString({ message: '表单名称必须为字符串' })
  @MinLength(1, { message: '表单名称不能为空' })
  @MaxLength(60, { message: '表单名称最多 60 个字符' })
  name!: string;

  @ApiPropertyOptional({ description: 'slug（缺省由名称生成，同站点唯一）' })
  @IsOptional()
  @IsString({ message: 'slug 必须为字符串' })
  @MaxLength(80, { message: 'slug 最多 80 个字符' })
  slug?: string;

  @ApiPropertyOptional({ description: '表单说明' })
  @IsOptional()
  @IsString({ message: '表单说明必须为字符串' })
  @MaxLength(500, { message: '表单说明最多 500 个字符' })
  description?: string;

  @ApiProperty({ description: '字段定义', type: [FormFieldDto] })
  @IsArray({ message: 'fields 必须为数组' })
  @ArrayNotEmpty({ message: '请至少配置一个表单字段' })
  @ArrayMaxSize(50, { message: '表单字段最多 50 个' })
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields!: FormFieldDto[];

  @ApiPropertyOptional({ description: '状态', enum: ['enabled', 'disabled'], default: 'enabled' })
  @IsOptional()
  @IsIn(['enabled', 'disabled'], { message: '状态只能为 enabled 或 disabled' })
  status?: 'enabled' | 'disabled';

  @ApiPropertyOptional({ description: '提交成功提示语' })
  @IsOptional()
  @IsString({ message: '成功提示必须为字符串' })
  @MaxLength(200, { message: '成功提示最多 200 个字符' })
  successMessage?: string;
}
