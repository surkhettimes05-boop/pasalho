import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePinDto {
  @ApiProperty()
  @IsString()
  currentPin: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  newPin: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  confirmNewPin: string;
}
