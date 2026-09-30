import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [DatabaseModule, CustomerAuthModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
