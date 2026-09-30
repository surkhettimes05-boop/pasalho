import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StorefrontSystemActorService } from '../common/storefront-system-actor.service';
import { CartsService } from '../carts/carts.service';
import { ServiceabilityService } from '../serviceability/serviceability.service';
import { StorefrontPricingService } from '../storefront-catalog/pricing.service';
import {
  CheckoutPriceSnapshot,
  CheckoutTokenService,
  checkoutPriceHash,
} from './checkout-token.service';
import { CheckoutPreviewDto } from './dto/checkout-preview.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { StorefrontReservationService } from './storefront-reservation.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly carts: CartsService,
    private readonly serviceability: ServiceabilityService,
    private readonly pricing: StorefrontPricingService,
    private readonly tokens: CheckoutTokenService,
    private readonly reservations: StorefrontReservationService,
    private readonly systemActor: StorefrontSystemActorService,
    private readonly audit: AuditLogService,
  ) {}

  async preview(customerId: string, dto: CheckoutPreviewDto) {
    await this.carts.claimForCustomer(dto.cartToken, customerId);
    const address = await this.getAddress(customerId, dto.addressId);

    const resolved = await this.serviceability.resolveCandidates({
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    });
    if (!resolved.serviceable) {
      throw new AppError(
        resolved.reason === 'FULFILLMENT_LOCATION_UNAVAILABLE'
          ? ErrorCodes.FULFILLMENT_LOCATION_UNAVAILABLE
          : ErrorCodes.OUTSIDE_SERVICE_ZONE,
        'This delivery address is not currently serviceable.',
        422,
      );
    }

    let priced: Awaited<ReturnType<CartsService['priceForLocation']>> | null = null;
    let selectedFulfillment: (typeof resolved.fulfillments)[number] | null = null;

    for (const candidate of resolved.fulfillments) {
      try {
        priced = await this.carts.priceForLocation(
          dto.cartToken,
          candidate.locationId,
          resolved.serviceZone.id,
        );
        selectedFulfillment = candidate;
        break;
      } catch (error) {
        if (
          error instanceof AppError &&
          [
            ErrorCodes.CART_NOT_FULFILLABLE,
            ErrorCodes.PRODUCT_NOT_ORDERABLE,
            ErrorCodes.INSUFFICIENT_STOCK,
          ].includes(error.code as any)
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!priced || !selectedFulfillment) {
      throw new AppError(
        ErrorCodes.CART_NOT_FULFILLABLE,
        'No Pasalho store in this service zone can fulfill the complete cart.',
        422,
      );
    }
    if (priced.subtotal + 0.0001 < priced.minOrder) {
      throw new AppError(
        ErrorCodes.MIN_ORDER_NOT_MET,
        `Minimum order is NPR ${priced.minOrder}.`,
        422,
        { minOrder: priced.minOrder },
      );
    }

    const priceSnapshot: CheckoutPriceSnapshot = {
      locationId: priced.locationId,
      serviceZoneId: priced.serviceZoneId,
      items: priced.items,
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      deliveryFee: priced.deliveryFee,
      handlingFee: priced.handlingFee,
      grandTotal: priced.grandTotal,
    };
    const priceHash = checkoutPriceHash(priceSnapshot);
    const checkoutToken = this.tokens.issue({
      customerId,
      cartToken: dto.cartToken,
      addressId: dto.addressId,
      paymentMethod: dto.paymentMethod,
      locationId: priced.locationId,
      serviceZoneId: priced.serviceZoneId,
      priceHash,
    });

    return {
      fulfillmentLocationId: selectedFulfillment.locationId,
      serviceZoneId: priced.serviceZoneId,
      items: priced.items,
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      deliveryFee: priced.deliveryFee,
      handlingFee: priced.handlingFee,
      grandTotal: priced.grandTotal,
      etaMinMinutes: resolved.delivery.etaMinMinutes,
      etaMaxMinutes: resolved.delivery.etaMaxMinutes,
      paymentMethod: dto.paymentMethod,
      checkoutToken,
    };
  }

  async placeOrder(
    customerId: string,
    idempotencyKey: string | undefined,
    dto: PlaceOrderDto,
  ) {
    if (!idempotencyKey || !this.isUuid(idempotencyKey)) {
      throw new AppError(
        ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
        'A UUID Idempotency-Key header is required.',
        422,
      );
    }

    const checkoutPayload = this.tokens.verify(dto.checkoutToken);
    if (
      checkoutPayload.customerId !== customerId ||
      checkoutPayload.cartToken !== dto.cartToken ||
      checkoutPayload.addressId !== dto.addressId ||
      checkoutPayload.paymentMethod !== dto.paymentMethod
    ) {
      throw new AppError(
        ErrorCodes.CART_PRICE_CHANGED,
        'Checkout preview does not match this order request.',
        409,
      );
    }

    const address = await this.getAddress(customerId, dto.addressId);
    const resolved = await this.serviceability.resolveCandidates({
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    });
    if (
      !resolved.serviceable ||
      resolved.serviceZone.id !== checkoutPayload.serviceZoneId ||
      !resolved.fulfillments.some(
        (candidate) => candidate.locationId === checkoutPayload.locationId,
      )
    ) {
      throw new AppError(
        ErrorCodes.CART_LOCATION_CHANGED,
        'Fulfillment store changed. Refresh checkout.',
        409,
      );
    }

    const actorUserId = await this.systemActor.getUserId();
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          customerId,
          cartToken: dto.cartToken,
          addressId: dto.addressId,
          paymentMethod: dto.paymentMethod,
        }),
      )
      .digest('hex');

    let transactionResult:
      | { response: Record<string, unknown>; replayed: boolean; orderId?: string; branchId?: string }
      | undefined;

    try {
      transactionResult = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.idempotencyRecord.findFirst({
            where: { scope: 'commerce.order.create', key: idempotencyKey },
          });
          if (existing) {
            if (existing.requestHash !== requestHash) {
              throw new AppError(
                ErrorCodes.IDEMPOTENCY_KEY_REUSED,
                'Idempotency key was already used for a different request.',
                409,
              );
            }
            if (existing.status === 'COMPLETED' && existing.responseBody) {
              return {
                response: existing.responseBody as Record<string, unknown>,
                replayed: true,
              };
            }
            throw new AppError(
              ErrorCodes.CONFLICT,
              'An order with this idempotency key is still processing.',
              409,
            );
          }

          await tx.idempotencyRecord.create({
            data: {
              scope: 'commerce.order.create',
              key: idempotencyKey,
              requestHash,
              expiresAt: new Date(Date.now() + 24 * 3600000),
            },
          });

          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Cart"
            WHERE "cartToken" = ${dto.cartToken}
            FOR UPDATE
          `;
          if (!locked[0]) {
            throw new AppError(ErrorCodes.CART_NOT_FOUND, 'Cart not found.', 404);
          }

          const cart = await tx.cart.findUnique({
            where: { cartToken: dto.cartToken },
            include: { items: { orderBy: { addedAt: 'asc' } } },
          });
          if (!cart || cart.status !== 'ACTIVE' || cart.expiresAt <= new Date()) {
            throw new AppError(ErrorCodes.CART_EXPIRED, 'Cart is not active.', 409);
          }
          if (cart.customerId && cart.customerId !== customerId) {
            throw new AppError(ErrorCodes.FORBIDDEN, 'Cart belongs to another customer.', 403);
          }
          if (cart.items.length === 0) {
            throw new AppError(ErrorCodes.CART_NOT_FULFILLABLE, 'Cart is empty.', 422);
          }

          const dbAddress = await tx.customerAddress.findFirst({
            where: {
              id: dto.addressId,
              customerId,
              deletedAt: null,
            },
          });
          if (!dbAddress || dbAddress.latitude == null || dbAddress.longitude == null) {
            throw new AppError(
              ErrorCodes.VALIDATION_ERROR,
              'Delivery address requires map coordinates.',
              422,
            );
          }

          const mapping = await tx.serviceZoneFulfillmentLocation.findFirst({
            where: {
              serviceZoneId: checkoutPayload.serviceZoneId,
              inventoryLocationId: checkoutPayload.locationId,
              isEnabled: true,
              serviceZone: { status: 'ACTIVE' },
              inventoryLocation: {
                status: 'ACTIVE',
                type: 'STORE',
                branch: { status: 'ACTIVE', deletedAt: null },
              },
            },
            include: {
              serviceZone: true,
              inventoryLocation: { include: { branch: true } },
            },
          });
          if (!mapping) {
            throw new AppError(
              ErrorCodes.FULFILLMENT_LOCATION_UNAVAILABLE,
              'Fulfillment store is unavailable.',
              422,
            );
          }

          const pricedItems: Array<{
            cartItemId: string;
            productId: string;
            unitId: string;
            quantity: number;
            baseQuantity: number;
            unitPrice: number;
            lineTotal: number;
          }> = [];
          let subtotal = 0;

          for (const cartItem of cart.items) {
            const config = await tx.storeProductConfig.findUnique({
              where: {
                inventoryLocationId_productId: {
                  inventoryLocationId: checkoutPayload.locationId,
                  productId: cartItem.productId,
                },
              },
              include: {
                product: { include: { productUnits: true } },
              },
            });
            if (
              !config?.isVisible ||
              !config.product.isActive ||
              !config.product.storefrontVisible ||
              config.product.deletedAt
            ) {
              throw new AppError(
                ErrorCodes.PRODUCT_NOT_ORDERABLE,
                'A cart product is no longer orderable.',
                422,
              );
            }

            const productUnit = config.product.productUnits.find(
              (candidate) => candidate.unitId === cartItem.unitId,
            );
            if (!productUnit && config.product.defaultUnitId !== cartItem.unitId) {
              throw new AppError(
                ErrorCodes.VALIDATION_ERROR,
                'Cart contains an invalid product unit.',
                422,
              );
            }

            const resolvedPrice = this.pricing.resolve(config.product, config);
            if (!resolvedPrice) {
              throw new AppError(
                ErrorCodes.PRODUCT_NOT_ORDERABLE,
                'A cart product has no valid selling price.',
                422,
              );
            }

            const quantity = Number(cartItem.quantity);
            const conversionToBase = Number(productUnit?.conversionToBase ?? 1);
            const baseQuantity = quantity * conversionToBase;
            if (
              config.maxOrderBaseQty != null &&
              baseQuantity > Number(config.maxOrderBaseQty) + 0.0000001
            ) {
              throw new AppError(
                ErrorCodes.VALIDATION_ERROR,
                'Cart quantity exceeds the store order limit.',
                422,
              );
            }

            const lineTotal = quantity * resolvedPrice.sellingPrice;
            subtotal += lineTotal;
            pricedItems.push({
              cartItemId: cartItem.id,
              productId: cartItem.productId,
              unitId: cartItem.unitId,
              quantity,
              baseQuantity,
              unitPrice: resolvedPrice.sellingPrice,
              lineTotal,
            });
          }

          const zone = mapping.serviceZone;
          if (subtotal + 0.0001 < Number(zone.minOrder)) {
            throw new AppError(
              ErrorCodes.MIN_ORDER_NOT_MET,
              `Minimum order is NPR ${Number(zone.minOrder)}.`,
              422,
            );
          }

          const freeThreshold =
            zone.freeDeliveryThreshold == null
              ? null
              : Number(zone.freeDeliveryThreshold);
          const deliveryFee =
            freeThreshold != null && subtotal >= freeThreshold
              ? 0
              : Number(zone.deliveryFee);
          const discountTotal = 0;
          const handlingFee = 0;
          const grandTotal =
            subtotal - discountTotal + deliveryFee + handlingFee;

          const currentPriceHash = checkoutPriceHash({
            locationId: checkoutPayload.locationId,
            serviceZoneId: checkoutPayload.serviceZoneId,
            items: pricedItems,
            subtotal,
            discountTotal,
            deliveryFee,
            handlingFee,
            grandTotal,
          });
          if (currentPriceHash !== checkoutPayload.priceHash) {
            throw new AppError(
              ErrorCodes.CART_PRICE_CHANGED,
              'Cart price changed. Refresh checkout before placing the order.',
              409,
            );
          }

          const orderNo = `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
          const addressSnapshot = {
            label: dbAddress.label,
            customLabel: dbAddress.customLabel,
            recipientName: dbAddress.recipientName,
            phone: dbAddress.phone,
            province: dbAddress.province,
            district: dbAddress.district,
            municipality: dbAddress.municipality,
            ward: dbAddress.ward,
            area: dbAddress.area,
            street: dbAddress.street,
            landmark: dbAddress.landmark,
            latitude: Number(dbAddress.latitude),
            longitude: Number(dbAddress.longitude),
            instructions: dbAddress.instructions,
          };

          const order = await tx.salesOrder.create({
            data: {
              orderNo,
              source: 'STOREFRONT',
              status: 'PLACED',
              branchId: mapping.inventoryLocation.branchId,
              customerId,
              customerAddressId: dbAddress.id,
              fulfillmentLocationId: mapping.inventoryLocation.id,
              cartId: cart.id,
              idempotencyKey: `commerce:${idempotencyKey}`,
              subtotal,
              discountTotal,
              taxTotal: 0,
              deliveryFee,
              handlingFee,
              couponDiscount: 0,
              grandTotal,
              deliveryAddressSnapshot: addressSnapshot,
              deliveryInstructions: dbAddress.instructions,
              createdById: actorUserId,
              placedAt: new Date(),
            },
          });

          const createdItems = [];
          for (const item of pricedItems) {
            const created = await tx.salesOrderItem.create({
              data: {
                salesOrderId: order.id,
                productId: item.productId,
                unitId: item.unitId,
                quantity: item.quantity,
                baseQuantity: item.baseQuantity,
                unitPrice: item.unitPrice,
                discountAmount: 0,
                taxAmount: 0,
                lineTotal: item.lineTotal,
              },
            });
            createdItems.push(created);
          }

          const reservationTtlMinutes = this.config.get<number>(
            'ORDER_RESERVATION_TTL_MINUTES',
            20,
          );
          await this.reservations.reserveOrder(tx, {
            salesOrderId: order.id,
            branchId: mapping.inventoryLocation.branchId,
            locationId: mapping.inventoryLocation.id,
            createdById: actorUserId,
            expiresAt: new Date(Date.now() + reservationTtlMinutes * 60000),
            items: createdItems.map((item) => ({
              salesOrderItemId: item.id,
              productId: item.productId,
              requestedBaseQuantity: Number(item.baseQuantity),
            })),
          });

          const payment = await tx.commercePayment.create({
            data: {
              paymentNo: `CPAY-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
              customerId,
              salesOrderId: order.id,
              method: 'COD',
              status: 'PENDING',
              amount: grandTotal,
              idempotencyKey: `commerce-payment:${idempotencyKey}`,
            },
          });

          await tx.orderStatusEvent.create({
            data: {
              salesOrderId: order.id,
              fromStatus: null,
              toStatus: 'PLACED',
              actorType: 'CUSTOMER',
              customerId,
              metadata: {
                fulfillmentLocationId: mapping.inventoryLocation.id,
              },
            },
          });

          await tx.cart.update({
            where: { id: cart.id },
            data: {
              customerId,
              inventoryLocationId: mapping.inventoryLocation.id,
              serviceZoneId: zone.id,
              status: 'CONVERTED',
              subtotal,
              discountTotal,
              deliveryFee,
              grandTotal,
              version: { increment: 1 },
            },
          });

          const response = {
            id: order.id,
            orderNo: order.orderNo,
            status: order.status,
            subtotal,
            discountTotal,
            deliveryFee,
            grandTotal,
            payment: {
              id: payment.id,
              method: payment.method,
              status: payment.status,
            },
            fulfillmentLocationId: mapping.inventoryLocation.id,
            delivery: {
              etaMinMinutes: zone.etaMinMinutes,
              etaMaxMinutes: zone.etaMaxMinutes,
            },
          };

          await tx.idempotencyRecord.update({
            where: {
              scope_key: {
                scope: 'commerce.order.create',
                key: idempotencyKey,
              },
            },
            data: {
              status: 'COMPLETED',
              responseStatus: 201,
              responseBody: response,
              resourceId: order.id,
              completedAt: new Date(),
            },
          });

          return {
            response,
            replayed: false,
            orderId: order.id,
            branchId: order.branchId ?? undefined,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.idempotencyRecord.findFirst({
          where: { scope: 'commerce.order.create', key: idempotencyKey },
        });
        if (
          existing?.requestHash === requestHash &&
          existing.status === 'COMPLETED' &&
          existing.responseBody
        ) {
          return existing.responseBody;
        }
        if (existing && existing.requestHash !== requestHash) {
          throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            'Idempotency key was already used for a different request.',
            409,
          );
        }
      }
      throw error;
    }

    if (!transactionResult) {
      throw new AppError(ErrorCodes.TRANSACTION_FAILED, 'Checkout did not complete.', 500);
    }

    if (!transactionResult.replayed && transactionResult.orderId) {
      await this.audit.record({
        actorUserId,
        action: 'SALES_ORDER_CREATED',
        entityType: 'SALES_ORDER',
        entityId: transactionResult.orderId,
        branchId: transactionResult.branchId,
        afterData: {
          source: 'STOREFRONT',
          idempotencyKey,
        },
      });
    }

    return transactionResult.response;
  }

  private async getAddress(customerId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId, deletedAt: null },
    });
    if (!address) throw new AppError(ErrorCodes.NOT_FOUND, 'Address not found.', 404);
    if (address.latitude == null || address.longitude == null) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Delivery address requires map coordinates.',
        422,
      );
    }
    return address;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
