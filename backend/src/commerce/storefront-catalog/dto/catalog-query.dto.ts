import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class StorefrontCatalogQueryDto {
  @IsUUID()
  locationId: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  productGroupId?: string;

  @IsOptional()
  @IsIn(['RELEVANCE', 'PRICE_ASC', 'PRICE_DESC', 'POPULAR'])
  sort?: 'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'POPULAR';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit = 24;
}

export class StorefrontSearchQueryDto extends StorefrontCatalogQueryDto {
  @IsString()
  q: string;
}
