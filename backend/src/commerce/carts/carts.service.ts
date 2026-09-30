import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StorefrontCatalogService } from '../storefront-catalog/storefront-catalog.service';
import { CreateCartDto } from './dto/create-cart.dto';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly catalog: StorefrontCatalogService,
  ) {}

  async create(dto: CreateCartDto) {
    const location = await this.prisma.inventoryLocation.findFirst({
      where: {
        id: dto.inventoryLocationId,
        type: 'STORE',
        status: 'ACTIVE',
        branch: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
    if (!location) {
      throw new AppError(
        ErrorCodes.FULFILLMENT_LOCATION_UNAVAILABLE,
        'Fulfillment store is unavailable.',
        422,
      );
    }

    if (dto.serviceZoneId) {
      const mapping = await this.prisma.serviceZoneFulfillmentLocation.findFirst({
        where: {
          serviceZoneId: dto.serviceZoneId,
          inventoryLocationId: dto.inventoryLocationId,
          isEnabled: true,
          serviceZone: { status: 'ACTIVE' },
        },
        select: { id: true },
      });
      if (!mapping) {
        throw new AppError(
          ErrorCodes.CART_LOCATION_CHANGED,
          'Store is not enabled for this service zone.',
          422,
        );
      }
    }

    const ttlHours = this.config.get<number>('CART_TTL_HOURS', 72);
    const cart = await this.prisma.cart.create({
      data: {
        cartToken: randomUUID(),
        inventoryLocationId: dto.inventoryLocationId,
        serviceZoneId: dto.serviceZoneId,
        expiresAt: new Date(Date.now() + ttlHours * 3600000),
      },
    });

    return this.get(cart.cartToken);
  }

  async get(cartToken: string) {
    await this.requireActiveCart(cartToken);
    return this.recalculate(cartToken);
  }

  async addItem(cartToken: string, dto: AddCartItemDto) {
    const cart = await this.requireActiveCart(cartToken);
    const orderable = await this.catalog.getOrderableProduct(
      cart.inventoryLocationId,
      dto.productId,
      dto.unitId,
    );

    this.ensureQuantityIsSellable(dto.quantity, orderable);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId_unitId: {
          cartId: cart.id,
          productId: dto.productId,
          unitId: dto.unitId,
        },
      },
    });
    const quantity = Number(existing?.quantity ?? 0) + dto.quantity;
    this.ensureQuantityIsSellable(quantity, orderable);

    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId_unitId: {
          cartId: cart.id,
          productId: dto.productId,
          unitId: dto.unitId,
        },
      },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        unitId: dto.unitId,
        quantity,
      },
      update: { quantity },
    });

    return this.recalculate(cartToken);
  }

  async updateItem(
    cartToken: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    const cart = await this.requireActiveCart(cartToken);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new AppError(ErrorCodes.NOT_FOUND, 'Cart item not found.', 404);

    const orderable = await this.catalog.getOrderableProduct(
      cart.inventoryLocationId,
      item.productId,
      item.unitId,
    );
    this.ensureQuantityIsSellable(dto.quantity, orderable);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });
    return this.recalculate(cartToken);
  }

  async removeItem(cartToken: string, itemId: string) {
    const cart = await this.requireActiveCart(cartToken);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    if (deleted.count === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cart item not found.', 404);
    }
    return this.recalculate(cartToken);
  }

  async revalidate(cartToken: string) {
    await this.requireActiveCart(cartToken);
    return this.recalculate(cartToken);
  }

  async claimForCustomer(cartToken: string, customerId: string) {
    const cart = await this.requireActiveCart(cartToken);
    if (cart.customerId && cart.customerId !== customerId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Cart belongs to another customer.', 403);
    }
    if (!cart.customerId) {
      return this.prisma.cart.update({
        where: { id: cart.id },
        data: { customerId },
      });
    }
    return cart;
  }

  async priceForLocation(
    cartToken: string,
    locationId: string,
    serviceZoneId: string,
  ) {
    const cart = await this.requireActiveCart(cartToken);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { addedAt: 'asc' },
    });
    if (items.length === 0) {
      throw new AppError(ErrorCodes.CART_NOT_FULFILLABLE, 'Cart is empty.', 422);
    }

    const zone = await this.prisma.serviceZone.findFirst({
      where: { id: serviceZoneId, status: 'ACTIVE' },
    });
    if (!zone) {
      throw new AppError(
        ErrorCodes.OUTSIDE_SERVICE_ZONE,
        'Service zone is unavailable.',
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
      mrp: number;
      lineTotal: number;
    }> = [];
    const unavailableProductIds: string[] = [];
    let subtotal = 0;

    for (const item of items) {
      try {
        const orderable = await this.catalog.getOrderableProduct(
          locationId,
          item.productId,
          item.unitId,
        );
        const quantity = Number(item.quantity);
        const baseQuantity = quantity * orderable.conversionToBase;
        if (
          baseQuantity > orderable.availability.sellableBaseQuantity + 0.0000001 ||
          quantity > orderable.availability.maxOrderQuantity + 0.0000001
        ) {
          unavailableProductIds.push(item.productId);
          continue;
        }

        const lineTotal = quantity * orderable.price.sellingPrice;
        subtotal += lineTotal;
        pricedItems.push({
          cartItemId: item.id,
          productId: item.productId,
          unitId: item.unitId,
          quantity,
          baseQuantity,
          unitPrice: orderable.price.sellingPrice,
          mrp: orderable.price.mrp,
          lineTotal,
        });
      } catch {
        unavailableProductIds.push(item.productId);
      }
    }

    if (unavailableProductIds.length > 0) {
      throw new AppError(
        ErrorCodes.CART_NOT_FULFILLABLE,
        'One or more cart items cannot be fulfilled by this store.',
        422,
        { unavailableProductIds },
      );
    }

    const discountTotal = 0;
    const freeThreshold = zone.freeDeliveryThreshold == null
      ? null
      : Number(zone.freeDeliveryThreshold);
    const deliveryFee =
      freeThreshold != null && subtotal >= freeThreshold
        ? 0
        : Number(zone.deliveryFee);
    const grandTotal = subtotal - discountTotal + deliveryFee;

    return {
      cartId: cart.id,
      cartToken: cart.cartToken,
      customerId: cart.customerId,
      locationId,
      serviceZoneId,
      items: pricedItems,
      subtotal,
      discountTotal,
      deliveryFee,
      handlingFee: 0,
      grandTotal,
      minOrder: Number(zone.minOrder),
    };
  }

  async requireActiveCart(cartToken: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { cartToken },
    });
    if (!cart) throw new AppError(ErrorCodes.CART_NOT_FOUND, 'Cart not found.', 404);

    if (cart.status !== 'ACTIVE' || cart.expiresAt <= new Date()) {
      if (cart.status === 'ACTIVE' && cart.expiresAt <= new Date()) {
        await this.prisma.cart.update({
          where: { id: cart.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new AppError(ErrorCodes.CART_EXPIRED, 'Cart has expired.', 409);
    }
    return cart;
  }

  private async recalculate(cartToken: string) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { cartToken },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, skuCode: true, imageUrl: true } },
            unit: { select: { id: true, symbol: true, name: true } },
          },
          orderBy: { addedAt: 'asc' },
        },
        serviceZone: true,
      },
    });

    let subtotal = 0;
    const changes: Array<Record<string, unknown>> = [];
    const items = [];

    for (const item of cart.items) {
      try {
        const orderable = await this.catalog.getOrderableProduct(
          cart.inventoryLocationId,
          item.productId,
          item.unitId,
        );
        const quantity = Number(item.quantity);
        const requestedBase = quantity * orderable.conversionToBase;
        const available = orderable.availability.sellableBaseQuantity + 0.0000001 >= requestedBase;
        const lineTotal = quantity * orderable.price.sellingPrice;
        subtotal += lineTotal;

        if (!available) {
          changes.push({
            type: 'INSUFFICIENT_STOCK',
            itemId: item.id,
            productId: item.productId,
            maxOrderQuantity: orderable.availability.maxOrderQuantity,
          });
        }

        items.push({
          id: item.id,
          productId: item.productId,
          unitId: item.unitId,
          quantity,
          product: item.product,
          unit: item.unit,
          price: orderable.price,
          availability: orderable.availability,
          lineTotal,
        });
      } catch (error) {
        changes.push({
          type: 'PRODUCT_NOT_ORDERABLE',
          itemId: item.id,
          productId: item.productId,
        });
        items.push({
          id: item.id,
          productId: item.productId,
          unitId: item.unitId,
          quantity: Number(item.quantity),
          product: item.product,
          unit: item.unit,
          unavailable: true,
        });
      }
    }

    const discountTotal = 0;
    const serviceZone = cart.serviceZone;
    const configuredDeliveryFee = Number(serviceZone?.deliveryFee ?? 0);
    const freeThreshold = serviceZone?.freeDeliveryThreshold == null
      ? null
      : Number(serviceZone.freeDeliveryThreshold);
    const deliveryFee =
      freeThreshold != null && subtotal >= freeThreshold
        ? 0
        : configuredDeliveryFee;
    const grandTotal = subtotal - discountTotal + deliveryFee;

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotal,
        discountTotal,
        deliveryFee,
        grandTotal,
        version: { increment: 1 },
      },
    });

    return {
      id: cart.id,
      cartToken: cart.cartToken,
      customerId: cart.customerId,
      inventoryLocationId: cart.inventoryLocationId,
      serviceZoneId: cart.serviceZoneId,
      status: cart.status,
      currency: cart.currency,
      items,
      subtotal,
      discountTotal,
      deliveryFee,
      grandTotal,
      expiresAt: cart.expiresAt,
      changes,
      checkoutAllowed: items.length > 0 && changes.length === 0,
    };
  }

  private ensureQuantityIsSellable(quantity: number, orderable: any) {
    const requestedBase = quantity * orderable.conversionToBase;
    if (
      requestedBase > orderable.availability.sellableBaseQuantity + 0.0000001 ||
      quantity > orderable.availability.maxOrderQuantity + 0.0000001
    ) {
      throw new AppError(
        ErrorCodes.INSUFFICIENT_STOCK,
        'Requested quantity is not currently available.',
        422,
        { maxOrderQuantity: orderable.availability.maxOrderQuantity },
      );
    }
  }
}
