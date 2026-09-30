import { IsOptional, IsUUID } from 'class-validator';

export class CreateCartDto {
  @IsUUID()
  inventoryLocationId: string;

  @IsOptional()
  @IsUUID()
  serviceZoneId?: string;
}
