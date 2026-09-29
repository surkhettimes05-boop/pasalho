import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString,
  IsUUID, Min, ValidateNested,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString() @IsNotEmpty() supplierCode: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() taxIdentifier?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() taxIdentifier?: string;
}

export class PurchaseOrderItemDto {
  @IsUUID() productId: string;
  @IsUUID() productUnitId: string;
  @IsNumber() @Min(0.000001) orderedQuantity: number;
  @IsNumber() @Min(0) unitCost: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID() supplierId: string;
  @IsUUID() warehouseId: string;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

export class GoodsReceiptItemDto {
  @IsUUID() purchaseOrderItemId: string;
  @IsNumber() @Min(0.000001) receivedQuantity: number;
  @IsNumber() @Min(0) acceptedQuantity: number;
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}

export class CreateGoodsReceiptDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => GoodsReceiptItemDto)
  items: GoodsReceiptItemDto[];
}
