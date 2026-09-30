import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export type CheckoutPriceSnapshot = {
  locationId: string;
  serviceZoneId: string;
  items: Array<{
    productId: string;
    unitId: string;
    quantity: number;
    baseQuantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  handlingFee: number;
  grandTotal: number;
};

export type CheckoutTokenPayload = {
  customerId: string;
  cartToken: string;
  addressId: string;
  paymentMethod: 'COD';
  locationId: string;
  serviceZoneId: string;
  priceHash: string;
  exp: number;
};

function fixed(value: number, decimals: number) {
  return Number(value).toFixed(decimals);
}

export function checkoutPriceHash(snapshot: CheckoutPriceSnapshot): string {
  const normalized = {
    locationId: snapshot.locationId,
    serviceZoneId: snapshot.serviceZoneId,
    items: [...snapshot.items]
      .sort((a, b) =>
        `${a.productId}:${a.unitId}`.localeCompare(
          `${b.productId}:${b.unitId}`,
        ),
      )
      .map((item) => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: fixed(item.quantity, 6),
        baseQuantity: fixed(item.baseQuantity, 6),
        unitPrice: fixed(item.unitPrice, 4),
        lineTotal: fixed(item.lineTotal, 4),
      })),
    subtotal: fixed(snapshot.subtotal, 4),
    discountTotal: fixed(snapshot.discountTotal, 4),
    deliveryFee: fixed(snapshot.deliveryFee, 4),
    handlingFee: fixed(snapshot.handlingFee, 4),
    grandTotal: fixed(snapshot.grandTotal, 4),
  };

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

@Injectable()
export class CheckoutTokenService {
  constructor(private readonly config: ConfigService) {}

  issue(payload: Omit<CheckoutTokenPayload, 'exp'>): string {
    const ttlSeconds = this.config.get<number>('CHECKOUT_TOKEN_TTL_SECONDS', 300);
    const complete: CheckoutTokenPayload = {
      ...payload,
      exp: Date.now() + ttlSeconds * 1000,
    };
    const body = Buffer.from(JSON.stringify(complete)).toString('base64url');
    return `${body}.${this.sign(body)}`;
  }

  verify(token: string): CheckoutTokenPayload {
    const [body, signature, ...extra] = token.split('.');
    if (!body || !signature || extra.length > 0) {
      throw this.invalid();
    }

    const expected = Buffer.from(this.sign(body));
    const provided = Buffer.from(signature);
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw this.invalid();
    }

    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as CheckoutTokenPayload;
      if (!payload.exp || payload.exp <= Date.now()) throw this.invalid();
      return payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw this.invalid();
    }
  }

  private sign(body: string) {
    const secret =
      this.config.get<string>('CUSTOMER_JWT_SECRET') ??
      this.config.get<string>('JWT_SECRET');
    if (!secret) throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Checkout signing secret is missing.', 500);
    return createHmac('sha256', secret).update(body).digest('base64url');
  }

  private invalid() {
    return new AppError(
      ErrorCodes.CART_PRICE_CHANGED,
      'Checkout preview is invalid or expired. Refresh checkout.',
      409,
    );
  }
}
