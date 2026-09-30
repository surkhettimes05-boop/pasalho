import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { FulfillmentShortageAction } from '@prisma/client';

export class ReportStorefrontShortageDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  shortageBaseQuantity: number;

  @IsEnum(FulfillmentShortageAction)
  action: FulfillmentShortageAction;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
