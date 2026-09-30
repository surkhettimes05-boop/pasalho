import { Injectable } from '@nestjs/common';

type ProductPrice = {
  sellingPrice: unknown;
  mrp: unknown;
};

type StorePriceConfig = {
  sellingPrice: unknown;
  mrp: unknown;
};

@Injectable()
export class StorefrontPricingService {
  resolve(product: ProductPrice, config: StorePriceConfig) {
    const sellingPrice = this.numberOrNull(config.sellingPrice) ??
      this.numberOrNull(product.sellingPrice) ??
      this.numberOrNull(config.mrp) ??
      this.numberOrNull(product.mrp);

    if (sellingPrice == null || sellingPrice <= 0) return null;

    const mrp = this.numberOrNull(config.mrp) ??
      this.numberOrNull(product.mrp) ??
      sellingPrice;

    const discountPercent = mrp > sellingPrice
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : 0;

    return {
      sellingPrice,
      mrp,
      discountPercent,
      discountAmount: Math.max(0, mrp - sellingPrice),
    };
  }

  private numberOrNull(value: unknown): number | null {
    if (value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
}
