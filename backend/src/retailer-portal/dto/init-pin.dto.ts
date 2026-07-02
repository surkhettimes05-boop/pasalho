import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class InitPinDto {
  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  pin: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  confirmPin: string;
}
