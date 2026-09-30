import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { DatabaseModule } from '../../database/database.module';
import { StorefrontSystemActorService } from '../common/storefront-system-actor.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomerOrdersController } from './orders.controller';
import { CustomerOrdersService } from './orders.service';
import { OrderStateMachineService } from './order-state-machine.service';
import { ReservationExpiryWorker } from './reservation-expiry.worker';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    CheckoutModule,
    CustomerAuthModule,
  ],
  controllers: [CustomerOrdersController],
  providers: [
    CustomerOrdersService,
    OrderStateMachineService,
    ReservationExpiryWorker,
    StorefrontSystemActorService,
  ],
  exports: [
    CustomerOrdersService,
    OrderStateMachineService,
  ],
})
export class CustomerOrdersModule {}
