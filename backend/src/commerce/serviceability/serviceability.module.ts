import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FulfillmentRouterService } from './fulfillment-router.service';
import { GeoService } from './geo.service';
import { ServiceabilityController } from './serviceability.controller';
import { ServiceabilityService } from './serviceability.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceabilityController],
  providers: [GeoService, FulfillmentRouterService, ServiceabilityService],
  exports: [GeoService, FulfillmentRouterService, ServiceabilityService],
})
export class ServiceabilityModule {}
