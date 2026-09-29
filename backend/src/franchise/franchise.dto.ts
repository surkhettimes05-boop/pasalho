import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateFranchisePartnerDto {
  @IsString() name: string;
  @IsString() phone: string;
  @IsOptional() @IsEmail() email?: string;
}

export class CreateFranchiseStoreDto {
  @IsUUID() partnerId: string;
  @IsString() name: string;
  @IsString() address: string;
}

export class FranchiseSupplyItemDto {
  @IsUUID() productId: string;
  @IsOptional() @IsUUID() unitId?: string;
  @Type(() => Number) @IsNumber() @Min(0.000001) quantity: number;
}

export class CreateFranchiseSupplyOrderDto {
  @IsUUID() storeId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FranchiseSupplyItemDto)
  items: FranchiseSupplyItemDto[];
}
