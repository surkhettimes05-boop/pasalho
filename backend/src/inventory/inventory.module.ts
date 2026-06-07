import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryLedgerService } from './services/inventory-ledger.service';
import { StockAdjustmentService } from './services/stock-adjustment.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  providers: [InventoryLedgerService, StockAdjustmentService],
  controllers: [InventoryController],
  exports: [InventoryLedgerService],
})
export class InventoryModule {}
