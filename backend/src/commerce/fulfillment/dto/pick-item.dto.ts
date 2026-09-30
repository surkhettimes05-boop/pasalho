import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class PickStorefrontItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pickedBaseQuantity: number;
}
