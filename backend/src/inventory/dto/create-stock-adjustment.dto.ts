import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { StockState } from '@prisma/client';

export class StockAdjustmentItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiProperty()
  @IsUUID()
  unitId: string;

  @ApiPropertyOptional({ enum: StockState })
  @IsOptional()
  @IsEnum(StockState)
  stockState?: StockState;

  @ApiProperty({ description: 'Signed quantity (+ for in, - for out)' })
  @IsNumber()
  quantityDelta: number;

  @ApiProperty({ description: 'Signed base quantity' })
  @IsNumber()
  baseQuantityDelta: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateStockAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsUUID()
  warehouseId: string;

  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [StockAdjustmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentItemDto)
  items: StockAdjustmentItemDto[];
}
