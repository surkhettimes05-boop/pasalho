import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password (minimum 6 characters)' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
