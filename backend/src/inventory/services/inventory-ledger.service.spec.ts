import { InventoryLedgerService } from './inventory-ledger.service';

describe('InventoryLedgerService invariants', () => {
  it('prevents negative available stock when applying an outbound movement', () => {
    expect(() =>
      InventoryLedgerService.assertSnapshotWillNotGoNegative(10, -11),
    ).toThrow('Insufficient stock');
  });

  it('allows stock increases through ledger movement deltas', () => {
    expect(InventoryLedgerService.calculateNextBaseQuantity(10, 5)).toBe(15);
  });

  it('requires batch id for batch tracked products', () => {
    expect(() => InventoryLedgerService.assertBatchRequirements(true, undefined)).toThrow(
      'Batch is required for this product',
    );
  });
});
