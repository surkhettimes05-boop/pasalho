import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelStorefrontOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(240)
  reason: string;
}
