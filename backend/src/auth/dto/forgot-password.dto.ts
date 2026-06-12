import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@pasalo.com', description: 'Email address of the account' })
  @IsEmail()
  email: string;
}
