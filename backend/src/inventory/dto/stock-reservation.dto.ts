import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReserveStockDto {
  @ApiProperty() @IsUUID() branchId: string;

  @ApiProperty() @IsUUID() locationId: string;

  @ApiProperty() @IsUUID() productId: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() batchId?: string;

  @ApiProperty() @IsUUID() unitId: string;

  @ApiProperty({ description: 'Quantity in the given unit' }) @IsNumber() quantity: number;

  @ApiProperty({ description: 'Quantity in base unit' }) @IsNumber() baseQuantity: number;

  @ApiProperty({ description: 'What this reservation is for (e.g. INVOICE, STOCK_TRANSFER)' }) @IsString() referenceType: string;

  @ApiProperty({ description: 'ID of the reference entity' }) @IsUUID() referenceId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class ReleaseStockDto {
  @ApiProperty() @IsUUID() branchId: string;

  @ApiProperty() @IsUUID() locationId: string;

  @ApiProperty() @IsUUID() productId: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() batchId?: string;

  @ApiProperty() @IsUUID() unitId: string;

  @ApiProperty({ description: 'Quantity in the given unit' }) @IsNumber() quantity: number;

  @ApiProperty({ description: 'Quantity in base unit' }) @IsNumber() baseQuantity: number;

  @ApiProperty({ description: 'What this release is for' }) @IsString() referenceType: string;

  @ApiProperty({ description: 'ID of the reference entity' }) @IsUUID() referenceId: string;

  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
