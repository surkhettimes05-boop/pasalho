import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { RetailerLedgerService } from './retailer-ledger/retailer-ledger.service';
import { FinancialLedgerService } from './financial-ledger/financial-ledger.service';
import { CreditLimitService } from './credit-limit/credit-limit.service';
import { PaymentAllocationService } from './payment-allocation/payment-allocation.service';
import { CashSessionService } from './cash-session/cash-session.service';
import { RetailerLedgerController } from './retailer-ledger/retailer-ledger.controller';
import { FinancialLedgerController } from './financial-ledger/financial-ledger.controller';
import { CreditLimitController } from './credit-limit/credit-limit.controller';
import { PaymentAllocationController } from './payment-allocation/payment-allocation.controller';
import { CashSessionController } from './cash-session/cash-session.controller';

@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [
    RetailerLedgerService,
    FinancialLedgerService,
    CreditLimitService,
    PaymentAllocationService,
    CashSessionService,
  ],
  controllers: [
    RetailerLedgerController,
    FinancialLedgerController,
    CreditLimitController,
    PaymentAllocationController,
    CashSessionController,
  ],
  exports: [
    RetailerLedgerService,
    FinancialLedgerService,
    CreditLimitService,
    PaymentAllocationService,
    CashSessionService,
  ],
})
export class FinanceModule {}
