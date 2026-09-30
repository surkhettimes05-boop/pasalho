import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CustomerAddressLabel } from '@prisma/client';

export class CreateAddressDto {
  @IsEnum(CustomerAddressLabel)
  label: CustomerAddressLabel = CustomerAddressLabel.HOME;

  @IsOptional() @IsString() @MaxLength(60) customLabel?: string;
  @IsOptional() @IsString() @MaxLength(120) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) province?: string;
  @IsOptional() @IsString() @MaxLength(80) district?: string;
  @IsOptional() @IsString() @MaxLength(100) municipality?: string;
  @IsOptional() @IsString() @MaxLength(30) ward?: string;

  @IsString() @MinLength(2) @MaxLength(160) area: string;
  @IsOptional() @IsString() @MaxLength(160) street?: string;
  @IsOptional() @IsString() @MaxLength(160) landmark?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;

  @IsOptional() @IsString() @MaxLength(300) instructions?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
