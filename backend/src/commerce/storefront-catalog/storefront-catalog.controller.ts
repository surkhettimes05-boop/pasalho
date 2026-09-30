import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorefrontCatalogService } from './storefront-catalog.service';
import {
  StorefrontCatalogQueryDto,
  StorefrontSearchQueryDto,
} from './dto/catalog-query.dto';

@ApiTags('commerce-catalog')
@Controller('commerce')
export class StorefrontCatalogController {
  constructor(private readonly catalog: StorefrontCatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List orderable storefront categories for a fulfillment store' })
  categories(@Query('locationId') locationId: string) {
    return this.catalog.categories(locationId);
  }

  @Get('products')
  @ApiOperation({ summary: 'List store-scoped storefront products' })
  products(@Query() query: StorefrontCatalogQueryDto) {
    return this.catalog.list(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search store-scoped storefront products' })
  search(@Query() query: StorefrontSearchQueryDto) {
    return this.catalog.search(query);
  }

  @Get('products/:identifier')
  @ApiOperation({ summary: 'Get storefront product detail and variants' })
  product(
    @Param('identifier') identifier: string,
    @Query('locationId') locationId: string,
  ) {
    return this.catalog.detail(identifier, locationId);
  }
}
