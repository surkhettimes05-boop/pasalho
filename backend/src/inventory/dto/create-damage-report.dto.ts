import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DamageType {
  PHYSICAL = 'PHYSICAL',
  EXPIRED = 'EXPIRED',
  WATER = 'WATER',
  PEST = 'PEST',
  OTHER = 'OTHER',
}

export class CreateDamageReportItemDto {
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

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  baseQuantity: number;

  @ApiProperty({ enum: DamageType })
  @IsEnum(DamageType)
  damageType: DamageType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDamageReportDto {
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

  @ApiProperty({ type: [CreateDamageReportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDamageReportItemDto)
  items: CreateDamageReportItemDto[];
}
