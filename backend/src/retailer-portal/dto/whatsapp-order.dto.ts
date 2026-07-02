import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WhatsAppOrderDto {
  @ApiProperty()
  @IsString()
  retailerPhone: string;

  @ApiProperty()
  @IsString()
  message: string;
}
