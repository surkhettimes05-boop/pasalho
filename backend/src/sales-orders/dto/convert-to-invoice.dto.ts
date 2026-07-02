import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConvertToInvoiceDto {
  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty()
  @IsUUID()
  sourceLocationId: string;
}
