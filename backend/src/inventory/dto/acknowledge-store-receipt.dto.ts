import { Type } from "class-transformer";
import { IsArray, IsNumber, IsString, Min, ValidateNested } from "class-validator";

export class AcknowledgeStoreReceiptItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;
}

export class AcknowledgeStoreReceiptDto {
  @IsString()
  destinationBranchCode!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcknowledgeStoreReceiptItemDto)
  items!: AcknowledgeStoreReceiptItemDto[];
}
