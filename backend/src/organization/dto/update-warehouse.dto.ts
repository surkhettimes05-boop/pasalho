import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MasterDataStatus } from '@prisma/client';

export class UpdateWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: MasterDataStatus })
  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}
