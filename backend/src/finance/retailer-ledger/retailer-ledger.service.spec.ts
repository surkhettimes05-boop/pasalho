import { RetailerLedgerService } from './retailer-ledger.service';

describe('RetailerLedgerService calculations', () => {
  it('derives outstanding balance from ledger debits and credits', () => {
    const outstanding = RetailerLedgerService.calculateOutstanding([
      { debitAmount: 1000, creditAmount: 0 },
      { debitAmount: 500, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 700 },
    ]);

    expect(outstanding).toBe(800);
  });
});
