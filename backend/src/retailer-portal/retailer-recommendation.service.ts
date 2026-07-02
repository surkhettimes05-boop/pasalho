import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RetailerRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuickReorder(retailerId: string, limit = 10) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        retailerId,
        status: { in: ['CONFIRMED', 'INVOICED'] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { id: true, createdAt: true },
    });

    const orderIds = orders.map((o) => o.id);
    const orderDateMap = new Map(orders.map((o) => [o.id, o.createdAt]));

    const recentItems = await this.prisma.salesOrderItem.findMany({
      where: { salesOrderId: { in: orderIds } },
      include: {
        product: { select: { id: true, name: true, skuCode: true } },
        batch: { select: { id: true, batchNumber: true } },
        unit: { select: { id: true, name: true, symbol: true } },
      },
    });

    const productMap = new Map<string, { product: any; count: number; lastOrderDate: Date; unit: any }>();
    for (const item of recentItems) {
      const orderDate = orderDateMap.get(item.salesOrderId) || new Date(0);
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.count++;
        if (orderDate > existing.lastOrderDate) {
          existing.lastOrderDate = orderDate;
        }
      } else {
        productMap.set(item.productId, {
          product: item.product,
          count: 1,
          lastOrderDate: orderDate,
          unit: item.unit,
        });
      }
    }

    const sorted = Array.from(productMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return sorted;
  }

  async getReorderSuggestions(retailerId: string) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const frequentItems = await this.prisma.salesOrderItem.groupBy({
      by: ['productId', 'unitId'],
      where: {
        salesOrder: {
          retailerId,
          status: { in: ['CONFIRMED', 'INVOICED'] },
          createdAt: { gte: ninetyDaysAgo },
        },
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: 20,
    });

    const productIds = frequentItems.map((f) => f.productId);
    const activeProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true, deletedAt: null },
      select: { id: true, name: true, skuCode: true },
    });

    const activeProductIds = new Set(activeProducts.map((p) => p.id));

    return frequentItems
      .filter((f) => activeProductIds.has(f.productId))
      .map((f) => {
        const product = activeProducts.find((p) => p.id === f.productId);
        return {
          product,
          unitId: f.unitId,
          orderCount: f._count.productId,
        };
      });
  }
}
