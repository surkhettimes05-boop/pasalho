import { Injectable } from '@nestjs/common';
import { OrderSource, StockState } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface PasaloDailySummary {
  sales: {
    b2b: number;
    online: number;
    franchise: number;
    orderCount: number;
    cancelledOrders: number;
  };
  inventory: {
    warehouse: { totalUnits: number; productCount: number };
    lowStockProducts: number;
  };
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailySummary(startDate: Date, endDate: Date): Promise<PasaloDailySummary> {
    const [orders, snapshots] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: {
          createdAt: { gte: startDate, lt: endDate },
          source: { in: [OrderSource.DNP, OrderSource.STOREFRONT, OrderSource.FRANCHISE] },
        },
        select: { source: true, retailerId: true, status: true, grandTotal: true },
      }),
      this.prisma.inventorySnapshot.findMany({
        where: {
          stockState: StockState.AVAILABLE,
          location: { is: { warehouseId: { not: null } } },
        },
        select: { productId: true, baseQuantity: true },
      }),
    ]);

    const sales = { b2b: 0, online: 0, franchise: 0, orderCount: 0, cancelledOrders: 0 };
    for (const order of orders) {
      const isB2b = order.source === OrderSource.DNP && Boolean(order.retailerId);
      const isOnline = order.source === OrderSource.STOREFRONT;
      const isFranchise = order.source === OrderSource.FRANCHISE;
      if (!isB2b && !isOnline && !isFranchise) continue;
      if (order.status === 'CANCELLED') {
        sales.cancelledOrders += 1;
        continue;
      }
      const total = Number(order.grandTotal);
      if (isB2b) sales.b2b += total;
      if (isOnline) sales.online += total;
      if (isFranchise) sales.franchise += total;
      sales.orderCount += 1;
    }

    const warehouseProducts = new Set<string>();
    let totalUnits = 0;
    const lowStockProducts = new Set<string>();
    for (const snapshot of snapshots) {
      const quantity = Number(snapshot.baseQuantity);
      totalUnits += quantity;
      warehouseProducts.add(snapshot.productId);
      if (quantity < 10) lowStockProducts.add(snapshot.productId);
    }

    return {
      sales,
      inventory: {
        warehouse: { totalUnits, productCount: warehouseProducts.size },
        lowStockProducts: lowStockProducts.size,
      },
    };
  }
}
