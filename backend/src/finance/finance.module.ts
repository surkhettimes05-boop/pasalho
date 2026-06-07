import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RetailerLedgerService } from './retailer-ledger/retailer-ledger.service';

@Module({
  imports: [DatabaseModule],
  providers: [RetailerLedgerService],
  exports: [RetailerLedgerService],
})
export class FinanceModule {}
