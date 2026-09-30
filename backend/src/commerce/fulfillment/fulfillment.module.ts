import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { CustomerOrdersModule } from '../orders/orders.module';
import { StorefrontFulfillmentController } from './fulfillment.controller';
import { StorefrontFulfillmentService } from './fulfillment.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CheckoutModule,
    CustomerOrdersModule,
  ],
  controllers: [StorefrontFulfillmentController],
  providers: [StorefrontFulfillmentService],
  exports: [StorefrontFulfillmentService],
})
export class StorefrontFulfillmentModule {}
