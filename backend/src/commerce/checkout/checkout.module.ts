import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { DatabaseModule } from '../../database/database.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { StorefrontSystemActorService } from '../common/storefront-system-actor.service';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CartsModule } from '../carts/carts.module';
import { ServiceabilityModule } from '../serviceability/serviceability.module';
import { StorefrontCatalogModule } from '../storefront-catalog/storefront-catalog.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutTokenService } from './checkout-token.service';
import { StorefrontReservationService } from './storefront-reservation.service';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    AuditModule,
    CustomerAuthModule,
    CartsModule,
    ServiceabilityModule,
    StorefrontCatalogModule,
  ],
  controllers: [CheckoutController],
  providers: [
    StorefrontReservationService,
    CheckoutTokenService,
    CheckoutService,
    StorefrontSystemActorService,
  ],
  exports: [StorefrontReservationService, CheckoutService],
})
export class CheckoutModule {}
