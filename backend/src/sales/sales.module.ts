import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { RetailerService } from './retailer.service';
import { RetailerController } from './retailer.controller';
import { SalesRepService } from './sales-rep.service';
import { SalesRepController } from './sales-rep.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, InventoryModule, FinanceModule],
  providers: [RetailerService, SalesRepService, InvoiceService, PaymentService],
  controllers: [RetailerController, SalesRepController, InvoiceController, PaymentController],
})
export class SalesModule {}
