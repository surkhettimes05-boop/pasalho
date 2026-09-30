import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { StorefrontAvailabilityService } from './availability.service';
import { StorefrontPricingService } from './pricing.service';
import { StorefrontCatalogController } from './storefront-catalog.controller';
import { StorefrontCatalogService } from './storefront-catalog.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StorefrontCatalogController],
  providers: [
    StorefrontAvailabilityService,
    StorefrontPricingService,
    StorefrontCatalogService,
  ],
  exports: [
    StorefrontAvailabilityService,
    StorefrontPricingService,
    StorefrontCatalogService,
  ],
})
export class StorefrontCatalogModule {}
