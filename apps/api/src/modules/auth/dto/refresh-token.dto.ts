import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: '登录时下发的刷新令牌（有效期 7 天）' })
  @IsString({ message: '刷新令牌必须为字符串' })
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  refreshToken: string;
}
