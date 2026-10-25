import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '管理员账号', example: 'admin' })
  @IsString({ message: '账号必须为字符串' })
  @IsNotEmpty({ message: '账号不能为空' })
  @MaxLength(64, { message: '账号长度不能超过 64 个字符' })
  username: string;

  @ApiProperty({ description: '登录密码', example: 'YourPassword' })
  @IsString({ message: '密码必须为字符串' })
  @IsNotEmpty({ message: '密码不能为空' })
  @MaxLength(128, { message: '密码长度不能超过 128 个字符' })
  password: string;
}
