import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 媒体上传表单字段（文件由 multipart 的 file 字段提供） */
export class UploadMediaDto {
  @ApiProperty({ description: '站点 ID（multipart 文本字段）' })
  @IsString({ message: '站点 ID 必须为字符串' })
  @IsNotEmpty({ message: '缺少站点 ID' })
  siteId!: string;

  @ApiPropertyOptional({ description: '自定义文件夹（缺省 yyyyMM）' })
  @IsOptional()
  @IsString({ message: '文件夹必须为字符串' })
  @MaxLength(80, { message: '文件夹名过长' })
  folder?: string;
}
