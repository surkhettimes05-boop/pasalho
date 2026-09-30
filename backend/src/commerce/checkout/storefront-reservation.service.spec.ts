import {
  allocateReservationSnapshots,
  ReservationSnapshot,
} from './storefront-reservation.service';

describe('allocateReservationSnapshots', () => {
  it('allocates one request across FEFO-ordered snapshots', () => {
    const snapshots: ReservationSnapshot[] = [
      { id: 'early', batchId: 'b1', unitId: 'piece', quantity: 4, baseQuantity: 4 },
      { id: 'later', batchId: 'b2', unitId: 'piece', quantity: 10, baseQuantity: 10 },
    ];

    expect(allocateReservationSnapshots(snapshots, 7)).toEqual([
      { snapshotId: 'early', batchId: 'b1', unitId: 'piece', quantity: 4, baseQuantity: 4 },
      { snapshotId: 'later', batchId: 'b2', unitId: 'piece', quantity: 3, baseQuantity: 3 },
    ]);
  });

  it('preserves snapshot unit ratios', () => {
    const snapshots: ReservationSnapshot[] = [
      { id: 'carton', batchId: null, unitId: 'carton', quantity: 2, baseQuantity: 12 },
    ];

    expect(allocateReservationSnapshots(snapshots, 6)[0]).toMatchObject({
      quantity: 1,
      baseQuantity: 6,
      unitId: 'carton',
    });
  });

  it('fails instead of partially reserving an incomplete request', () => {
    expect(() =>
      allocateReservationSnapshots(
        [{ id: 'x', batchId: null, unitId: 'piece', quantity: 2, baseQuantity: 2 }],
        3,
      ),
    ).toThrow('Insufficient sellable inventory');
  });
});
