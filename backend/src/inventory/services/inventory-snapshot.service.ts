import { Injectable } from '@nestjs/common';
import { Prisma, StockState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export interface SnapshotFilter {
  branchId?: string;
  locationId?: string;
  productId?: string;
  stockState?: StockState;
  lowStock?: boolean;
  lowStockThreshold?: number;
  search?: string;
}

@Injectable()
export class InventorySnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated snapshot listing with rich filters.
   * Supports: location, branch, product, state, low-stock, search.
   */
  async listSnapshots(filter: SnapshotFilter, pagination: PaginationDto) {
    const where: Prisma.InventorySnapshotWhereInput = {};

    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.productId) where.productId = filter.productId;
    if (filter.stockState) where.stockState = filter.stockState;

    // Low stock filter
    if (filter.lowStock) {
      const threshold = filter.lowStockThreshold ?? 10;
      where.baseQuantity = { lt: threshold };
    }

    // Branch filter — go through location -> branch
    if (filter.branchId) {
      where.location = { branchId: filter.branchId };
    }

    // Search by product name / SKU / barcode
    if (filter.search) {
      where.product = {
        isActive: true,
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { skuCode: { contains: filter.search, mode: 'insensitive' } },
          { barcode: { contains: filter.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventorySnapshot.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          product: { include: { category: true, defaultUnit: true } },
          batch: true,
          unit: true,
          location: { include: { branch: { select: { id: true, name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventorySnapshot.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  /**
   * Single snapshot by ID with full relations.
   */
  async findById(id: string) {
    const snapshot = await this.prisma.inventorySnapshot.findUnique({
      where: { id },
      include: {
        product: { include: { category: true, brand: true, defaultUnit: true, productUnits: { include: { unit: true } } } },
        batch: true,
        unit: true,
        location: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    });
    if (!snapshot) throw new AppError(ErrorCodes.NOT_FOUND, 'Inventory snapshot not found.', 404);
    return snapshot;
  }

  /**
   * Aggregated stock summary for a branch or location.
   * Returns total SKUs, total available qty, low-stock count, out-of-stock count.
   */
  async getStockSummary(branchId?: string, locationId?: string) {
    const locationFilter: any = {};
    if (branchId) locationFilter.location = { branchId };
    if (locationId) locationFilter.locationId = locationId;

    const [totalSkus, lowStockCount, outOfStockCount, totalAvailable] = await Promise.all([
      // Total distinct product-location combos
      this.prisma.inventorySnapshot.count({
        where: { ...locationFilter, stockState: 'AVAILABLE' },
      }),
      // Low stock (base < 10)
      this.prisma.inventorySnapshot.count({
        where: { ...locationFilter, stockState: 'AVAILABLE', baseQuantity: { lt: 10, gt: 0 } },
      }),
      // Out of stock
      this.prisma.inventorySnapshot.count({
        where: { ...locationFilter, stockState: 'AVAILABLE', baseQuantity: { lte: 0 } },
      }),
      // Sum of all available base quantity
      this.prisma.inventorySnapshot.aggregate({
        where: { ...locationFilter, stockState: 'AVAILABLE' },
        _sum: { baseQuantity: true },
      }),
    ]);

    return {
      totalSkus,
      lowStockCount,
      outOfStockCount,
      totalAvailableBaseQty: Number(totalAvailable._sum.baseQuantity ?? 0),
    };
  }

  /**
   * Get all snapshots for a specific product across all locations.
   * Useful for checking total stock of a product before transfer/sale.
   */
  async getStockByProduct(productId: string, branchId?: string) {
    const where: Prisma.InventorySnapshotWhereInput = {
      productId,
      stockState: 'AVAILABLE',
    };
    if (branchId) {
      where.location = { branchId };
    }

    const snapshots = await this.prisma.inventorySnapshot.findMany({
      where,
      include: {
        location: { include: { branch: { select: { id: true, name: true, code: true } }, warehouse: true } },
        unit: true,
        batch: true,
      },
      orderBy: { baseQuantity: 'desc' },
    });

    const totalBaseQty = snapshots.reduce((sum, s) => sum + Number(s.baseQuantity), 0);

    return { snapshots, totalBaseQty };
  }

  /**
   * Get all snapshots for a specific location — flat list (no pagination).
   * Lightweight version for dropdowns / quick views.
   */
  async getLocationStockFlat(locationId: string) {
    return this.prisma.inventorySnapshot.findMany({
      where: { locationId, stockState: 'AVAILABLE', baseQuantity: { gt: 0 } },
      include: {
        product: { select: { id: true, name: true, skuCode: true, barcode: true } },
        unit: { select: { id: true, code: true, name: true, symbol: true } },
        batch: { select: { id: true, batchNumber: true, expiryDate: true, status: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }
}
