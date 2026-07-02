import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RetailerNotificationService } from './retailer-notification.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

interface ParsedItem {
  productName: string;
  quantity: number;
}

@Injectable()
export class WhatsAppOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: RetailerNotificationService,
  ) {}

  async processWhatsAppMessage(phone: string, message: string) {
    const retailer = await this.prisma.retailer.findFirst({
      where: { phone, deletedAt: null },
    });

    if (!retailer) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Retailer not found for this phone number.', 404);
    }

    const lines = message.split('\n').filter((l) => l.trim());
    const parsedItems: ParsedItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const matchX = trimmed.match(/^(\d+)[xX\*]\s*(.+)/);
      const matchNameFirst = trimmed.match(/^(.+?)\s+(\d+)$/);

      if (matchX) {
        parsedItems.push({ productName: matchX[2].trim(), quantity: parseInt(matchX[1], 10) });
      } else if (matchNameFirst) {
        parsedItems.push({ productName: matchNameFirst[1].trim(), quantity: parseInt(matchNameFirst[2], 10) });
      }
    }

    if (parsedItems.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Could not parse any product from the message.', 400);
    }

    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
    });

    const resolvedItems: Array<{ productId: string; unitId: string; quantity: number; productName: string }> = [];

    for (const parsed of parsedItems) {
      const exactMatch = products.find(
        (p) => p.name.toLowerCase() === parsed.productName.toLowerCase(),
      );
      const partialMatch = products.find(
        (p) => p.name.toLowerCase().includes(parsed.productName.toLowerCase()),
      );

      const matched = exactMatch || partialMatch;
      if (!matched) {
        continue;
      }

      resolvedItems.push({
        productId: matched.id,
        unitId: matched.defaultUnitId,
        quantity: parsed.quantity,
        productName: matched.name,
      });
    }

    if (resolvedItems.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'No products could be matched from the message.', 400);
    }

    const orderNo = `WHATSAPP-${Date.now()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.salesOrder.create({
        data: {
          orderNo,
          branchId: retailer.branchId,
          retailerId: retailer.id,
          salesRepId: '',
          notes: `WhatsApp order: ${message}`,
          subtotal: 0,
          grandTotal: 0,
          createdById: retailer.id,
          status: 'DRAFT',
        },
      });

      let subtotal = 0;
      for (const item of resolvedItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const unitPrice = Number(product.mrp || 0);

        await tx.salesOrderItem.create({
          data: {
            salesOrderId: o.id,
            productId: item.productId,
            unitId: item.unitId,
            quantity: item.quantity,
            baseQuantity: item.quantity,
            unitPrice,
            lineTotal: item.quantity * unitPrice,
          },
        });

        subtotal += item.quantity * unitPrice;
      }

      await tx.salesOrder.update({
        where: { id: o.id },
        data: { subtotal, grandTotal: subtotal },
      });

      return tx.salesOrder.findUnique({
        where: { id: o.id },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, skuCode: true } },
              unit: { select: { id: true, name: true, symbol: true } },
            },
          },
        },
      });
    });

    await this.notificationService.create({
      retailerId: retailer.id,
      branchId: retailer.branchId,
      type: 'ORDER_CONFIRMED',
      title: 'WhatsApp Order Received',
      message: `Your WhatsApp order ${orderNo} has been received and is awaiting review.`,
      entityType: 'SALES_ORDER' as any,
      entityId: order.id,
    });

    return {
      order,
      parsedItems: resolvedItems.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
      })),
      unmatched: parsedItems
        .filter((p) => !resolvedItems.some((r) => r.productName === p.productName))
        .map((p) => p.productName),
    };
  }
}
