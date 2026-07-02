import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryLedgerService } from './services/inventory-ledger.service';
import { StockAdjustmentService } from './services/stock-adjustment.service';
import { InventorySnapshotService } from './services/inventory-snapshot.service';
import { StockReservationService } from './services/stock-reservation.service';
import { InventoryReconciliationService } from './services/inventory-reconciliation.service';
import { StockTransferService } from './services/stock-transfer.service';
import { DamageReportService } from './services/damage-report.service';
import { ExpiryService } from './services/expiry.service';
import { InventoryController } from './inventory.controller';
import { InventoryReconciliationController } from './inventory-reconciliation.controller';
import { TransferController } from './transfer.controller';
import { DamageReportController } from './damage-report.controller';
import { ExpiryController } from './expiry.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  providers: [
    InventoryLedgerService,
    StockAdjustmentService,
    InventorySnapshotService,
    StockReservationService,
    InventoryReconciliationService,
    StockTransferService,
    DamageReportService,
    ExpiryService,
  ],
  controllers: [
    InventoryController,
    InventoryReconciliationController,
    TransferController,
    DamageReportController,
    ExpiryController,
  ],
  exports: [
    InventoryLedgerService,
    InventorySnapshotService,
    StockReservationService,
    InventoryReconciliationService,
    StockTransferService,
    DamageReportService,
    ExpiryService,
  ],
})
export class InventoryModule {}
