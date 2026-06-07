import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VoidInvoiceDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
