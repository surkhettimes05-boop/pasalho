import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, SalesModule, InventoryModule, FinanceModule],
  providers: [SalesOrderService],
  controllers: [SalesOrderController],
  exports: [SalesOrderService],
})
export class SalesOrdersModule {}
