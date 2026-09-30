import { Injectable } from '@nestjs/common';

type Snapshot = {
  baseQuantity: unknown;
  batch: { status: string; expiryDate: Date | null } | null;
};

type ProductUnit = {
  unitId: string;
  conversionToBase: unknown;
};

@Injectable()
export class StorefrontAvailabilityService {
  calculate(input: {
    snapshots: Snapshot[];
    safetyStockBaseQty: unknown;
    maxOrderBaseQty: unknown;
    defaultUnitId: string;
    productUnits: ProductUnit[];
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const availableBase = input.snapshots.reduce((total, snapshot) => {
      if (snapshot.batch) {
        if (snapshot.batch.status !== 'ACTIVE') return total;
        if (snapshot.batch.expiryDate && snapshot.batch.expiryDate <= now) return total;
      }
      return total + Number(snapshot.baseQuantity);
    }, 0);

    const safety = Math.max(0, Number(input.safetyStockBaseQty ?? 0));
    let sellableBase = Math.max(0, availableBase - safety);

    const configuredMax = input.maxOrderBaseQty == null
      ? null
      : Math.max(0, Number(input.maxOrderBaseQty));
    if (configuredMax != null) sellableBase = Math.min(sellableBase, configuredMax);

    const conversion = Number(
      input.productUnits.find((unit) => unit.unitId === input.defaultUnitId)?.conversionToBase ?? 1,
    ) || 1;
    const maxOrderQuantity = Math.max(0, Math.floor((sellableBase / conversion) * 1_000_000) / 1_000_000);

    const state =
      maxOrderQuantity <= 0
        ? 'OUT_OF_STOCK'
        : maxOrderQuantity <= 3
          ? 'LOW_STOCK'
          : 'AVAILABLE';

    return { state, maxOrderQuantity, sellableBaseQuantity: sellableBase };
  }
}
