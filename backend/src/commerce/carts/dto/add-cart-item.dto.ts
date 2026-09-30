import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  unitId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;
}
