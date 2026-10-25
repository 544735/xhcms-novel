import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** 试采集入参：可临时覆盖书籍页地址 */
export class TestBookSourceDto {
  @ApiPropertyOptional({
    description: '书籍页地址；缺省使用书源 baseUrl',
    example: 'http://127.0.0.1:4000/api/v1/public/demo/collect/book',
  })
  @IsOptional()
  @IsString({ message: '书籍页地址必须为字符串' })
  @MaxLength(500, { message: '书籍页地址不能超过 500 个字符' })
  @Matches(/^https?:\/\/.+/i, { message: '书籍页地址必须以 http:// 或 https:// 开头' })
  bookUrl?: string;
}
