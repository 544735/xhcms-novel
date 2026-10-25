import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString({ message: '原密码必须为字符串' })
  @IsNotEmpty({ message: '原密码不能为空' })
  oldPassword: string;

  @ApiProperty({ description: '新密码，至少 8 位', minLength: 8 })
  @IsString({ message: '新密码必须为字符串' })
  @MinLength(8, { message: '新密码长度至少 8 位' })
  @MaxLength(72, { message: '新密码长度不能超过 72 位' })
  newPassword: string;
}
