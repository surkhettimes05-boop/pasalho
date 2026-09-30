import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorefrontSystemActorService } from './common/storefront-system-actor.service';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [DatabaseModule, CustomerAuthModule, CustomersModule],
  providers: [StorefrontSystemActorService],
  exports: [StorefrontSystemActorService],
})
export class CommerceModule {}
