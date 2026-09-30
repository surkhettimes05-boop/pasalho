import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { StorefrontReservationService } from './storefront-reservation.service';

@Module({
  imports: [DatabaseModule, InventoryModule],
  providers: [StorefrontReservationService],
  exports: [StorefrontReservationService],
})
export class CheckoutModule {}
