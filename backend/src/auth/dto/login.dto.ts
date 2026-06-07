import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@pasalo.com', description: 'Email address or phone number' })
  @IsString()
  login: string; // email or phone

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
