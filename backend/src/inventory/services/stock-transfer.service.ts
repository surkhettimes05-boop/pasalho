import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { CreateStockTransferDto } from '../dto/create-stock-transfer.dto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StockTransferStatus, InventoryMovementType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class StockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly inventoryLedger: InventoryLedgerService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.OR = [
        { fromBranchId: branchId },
        { toBranchId: branchId }
      ];
    }

    if (pagination.search) {
      where.transferNo = { contains: pagination.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          fromBranch: true,
          toBranch: true,
          fromWarehouse: true,
          toWarehouse: true,
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, batch: true, unit: true } },
        fromBranch: true,
        toBranch: true,
        fromWarehouse: true,
        toWarehouse: true,
        fromLocation: true,
        toLocation: true,
        createdBy: { select: { id: true, fullName: true } },
        shippedBy: { select: { id: true, fullName: true } },
        receivedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!transfer) throw new AppError(ErrorCodes.NOT_FOUND, 'Stock transfer not found.', 404);
    return transfer;
  }

  async create(dto: CreateStockTransferDto, actorUserId: string) {
    const transferNo = `TRF-${Date.now()}`;

    const transfer = await this.prisma.$transaction(async (tx) => {
      const trf = await tx.stockTransfer.create({
        data: {
          transferNo,
          fromBranchId: dto.fromBranchId,
          fromWarehouseId: dto.fromWarehouseId,
          fromLocationId: dto.fromLocationId,
          toBranchId: dto.toBranchId,
          toWarehouseId: dto.toWarehouseId,
          toLocationId: dto.toLocationId,
          notes: dto.notes,
          createdById: actorUserId,
          status: StockTransferStatus.DRAFT,
        },
      });

      for (const item of dto.items) {
        await tx.stockTransferItem.create({
          data: {
            stockTransferId: trf.id,
            productId: item.productId,
            batchId: item.batchId,
            unitId: item.unitId,
            stockState: item.stockState || 'AVAILABLE',
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
          },
        });
      }

      return trf;
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_TRANSFER_CREATED',
      entityType: 'STOCK_TRANSFER',
      entityId: transfer.id,
      branchId: dto.fromBranchId,
      afterData: { transferNo, fromWarehouseId: dto.fromWarehouseId, toWarehouseId: dto.toWarehouseId },
    });

    return this.findById(transfer.id);
  }

  async ship(id: string, actorUserId: string) {
    const transfer = await this.findById(id);

    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT transfers can be shipped.', 422);
    }

    // Post inventory movements: AVAILABLE -> IN_TRANSIT at origin
    await this.inventoryLedger.postEvent({
      eventType: 'STOCK_TRANSFER',
      branchId: transfer.fromBranchId,
      referenceType: 'STOCK_TRANSFER',
      referenceId: transfer.id,
      createdById: actorUserId,
      idempotencyKey: `transfer-ship-${transfer.id}`,
      movements: transfer.items.flatMap((item) => [
        {
          locationId: transfer.fromLocationId,
          productId: item.productId,
          batchId: item.batchId || undefined,
          unitId: item.unitId,
          stockState: 'AVAILABLE',
          quantityDelta: -Number(item.quantity),
          baseQuantityDelta: -Number(item.baseQuantity),
          movementType: 'TRANSFER_OUT',
          reasonCode: 'TRANSFER_SHIP_OUT',
        },
        {
          locationId: transfer.fromLocationId,
          productId: item.productId,
          batchId: item.batchId || undefined,
          unitId: item.unitId,
          stockState: 'IN_TRANSIT',
          quantityDelta: Number(item.quantity),
          baseQuantityDelta: Number(item.baseQuantity),
          movementType: 'TRANSFER_OUT',
          reasonCode: 'TRANSFER_IN_TRANSIT',
        },
      ]),
    });

    const updated = await this.prisma.stockTransfer.update({
      where: { id },
      data: {
        status: StockTransferStatus.SHIPPED,
        shippedById: actorUserId,
        shippedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_TRANSFER_SHIPPED',
      entityType: 'STOCK_TRANSFER',
      entityId: id,
      branchId: transfer.fromBranchId,
      afterData: { status: StockTransferStatus.SHIPPED },
    });

    return updated;
  }

  async receive(id: string, actorUserId: string) {
    const transfer = await this.findById(id);

    if (transfer.status !== StockTransferStatus.SHIPPED) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only SHIPPED transfers can be received.', 422);
    }

    // Post inventory movements: IN_TRANSIT at origin -> AVAILABLE at destination
    // 1. Deduct from origin IN_TRANSIT
    await this.inventoryLedger.postEvent({
      eventType: 'STOCK_TRANSFER',
      branchId: transfer.fromBranchId,
      referenceType: 'STOCK_TRANSFER',
      referenceId: transfer.id,
      createdById: actorUserId,
      idempotencyKey: `transfer-receive-origin-${transfer.id}`,
      movements: transfer.items.map((item) => ({
        locationId: transfer.fromLocationId,
        productId: item.productId,
        batchId: item.batchId || undefined,
        unitId: item.unitId,
        stockState: 'IN_TRANSIT',
        quantityDelta: -Number(item.quantity),
        baseQuantityDelta: -Number(item.baseQuantity),
        movementType: 'TRANSFER_IN',
        reasonCode: 'TRANSFER_RECEIVE_OUT',
      })),
    });

    // 2. Add to destination AVAILABLE (use received quantity if provided, else full shipped qty)
    const movements = transfer.items.map((item) => {
      const receivedQty = item.receivedQuantity
        ? Number(item.receivedQuantity)
        : Number(item.quantity);
      const receivedBaseQty = item.receivedBaseQuantity
        ? Number(item.receivedBaseQuantity)
        : Number(item.baseQuantity);
      return {
        locationId: transfer.toLocationId,
        productId: item.productId,
        batchId: item.batchId || undefined,
        unitId: item.unitId,
        stockState: 'AVAILABLE' as const,
        quantityDelta: receivedQty,
        baseQuantityDelta: receivedBaseQty,
        movementType: 'TRANSFER_IN' as const,
        reasonCode: 'TRANSFER_RECEIVE_IN',
      };
    });

    await this.inventoryLedger.postEvent({
      eventType: 'STOCK_TRANSFER',
      branchId: transfer.toBranchId,
      referenceType: 'STOCK_TRANSFER',
      referenceId: transfer.id,
      createdById: actorUserId,
      idempotencyKey: `transfer-receive-dest-${transfer.id}`,
      movements,
    });

    const updated = await this.prisma.stockTransfer.update({
      where: { id },
      data: {
        status: StockTransferStatus.RECEIVED,
        receivedById: actorUserId,
        receivedAt: new Date(),
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_TRANSFER_RECEIVED',
      entityType: 'STOCK_TRANSFER',
      entityId: id,
      branchId: transfer.toBranchId,
      afterData: { status: StockTransferStatus.RECEIVED },
    });

    return updated;
  }
}
