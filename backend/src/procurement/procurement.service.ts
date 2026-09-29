import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { IdempotencyStatus, Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InventoryLedgerService } from '../inventory/services/inventory-ledger.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateGoodsReceiptDto, CreatePurchaseOrderDto, CreateSupplierDto, UpdateSupplierDto } from './dto/procurement.dto';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly audit: AuditLogService,
  ) {}

  async listSuppliers(pagination: PaginationDto) {
    const where: Prisma.SupplierWhereInput = pagination.search
      ? { OR: [{ name: { contains: pagination.search, mode: 'insensitive' } }, { supplierCode: { contains: pagination.search, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, skip: pagination.skip, take: pagination.limit, orderBy: { name: 'asc' } }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async getSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new AppError(ErrorCodes.NOT_FOUND, 'Supplier not found.', 404);
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto, actorUserId: string) {
    const supplier = await this.prisma.supplier.create({ data: dto });
    await this.audit.record({ actorUserId, action: 'SUPPLIER_CREATED', entityType: 'SUPPLIER', entityId: supplier.id });
    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, actorUserId: string) {
    await this.getSupplier(id);
    const supplier = await this.prisma.supplier.update({ where: { id }, data: dto });
    await this.audit.record({ actorUserId, action: 'SUPPLIER_UPDATED', entityType: 'SUPPLIER', entityId: id });
    return supplier;
  }

  async deactivateSupplier(id: string, actorUserId: string) {
    await this.getSupplier(id);
    const supplier = await this.prisma.supplier.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.audit.record({ actorUserId, action: 'SUPPLIER_DEACTIVATED', entityType: 'SUPPLIER', entityId: id });
    return supplier;
  }

  async listPurchaseOrders(pagination: PaginationDto, warehouseId: string) {
    const where = { warehouseId };
    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where, skip: pagination.skip, take: pagination.limit, include: { supplier: true, warehouse: true, items: { include: { product: true, productUnit: { include: { unit: true } } } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async getPurchaseOrder(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, warehouse: true, items: { include: { product: true, productUnit: { include: { unit: true } } } }, goodsReceipts: { include: { items: true }, orderBy: { receivedAt: 'asc' } } },
    });
    if (!po) throw new AppError(ErrorCodes.NOT_FOUND, 'Purchase order not found.', 404);
    return po;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, actorUserId: string) {
    if (!dto.items?.length) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Purchase order must contain at least one item.', 422);
    const [supplier, warehouse] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId }, include: { inventoryLocation: true } }),
    ]);
    if (!supplier || supplier.status !== 'ACTIVE') throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Supplier is missing or inactive.', 422);
    if (!warehouse || warehouse.status !== 'ACTIVE' || !warehouse.inventoryLocation || warehouse.inventoryLocation.status !== 'ACTIVE') throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Active warehouse inventory location is required.', 422);

    const productUnits = await this.prisma.productUnit.findMany({ where: { id: { in: dto.items.map((item) => item.productUnitId) } }, include: { product: true } });
    if (productUnits.length !== dto.items.length || dto.items.some((item) => !productUnits.some((pu) => pu.id === item.productUnitId && pu.productId === item.productId && pu.product.isActive))) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'A product unit is invalid or does not belong to its product.', 422);
    }
    const subtotal = dto.items.reduce((sum, item) => sum.add(new Prisma.Decimal(item.orderedQuantity).mul(item.unitCost)), new Prisma.Decimal(0));
    const purchaseOrderNumber = `PO-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const po = await this.prisma.purchaseOrder.create({
      data: {
        purchaseOrderNumber, supplierId: supplier.id, warehouseId: warehouse.id, branchId: warehouse.branchId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined, notes: dto.notes, subtotal, createdById: actorUserId,
        items: { create: dto.items.map((item) => ({ productId: item.productId, productUnitId: item.productUnitId, orderedQuantity: item.orderedQuantity, unitCost: item.unitCost, lineTotal: new Prisma.Decimal(item.orderedQuantity).mul(item.unitCost) })) },
      },
    });
    await this.audit.record({ actorUserId, action: 'PURCHASE_ORDER_CREATED', entityType: 'PURCHASE_ORDER', entityId: po.id, branchId: warehouse.branchId, afterData: { purchaseOrderNumber, subtotal: subtotal.toString() } });
    return this.getPurchaseOrder(po.id);
  }

  async confirmPurchaseOrder(id: string, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE`;
      if (!locked.length) throw new AppError(ErrorCodes.NOT_FOUND, 'Purchase order not found.', 404);
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
      if (po.status !== 'DRAFT') throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT purchase orders can be confirmed.', 422);
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'CONFIRMED' } });
      await this.audit.record({ actorUserId, action: 'PURCHASE_ORDER_CONFIRMED', entityType: 'PURCHASE_ORDER', entityId: id, branchId: po.branchId }, tx);
    });
    return this.getPurchaseOrder(id);
  }

  async cancelPurchaseOrder(id: string, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PurchaseOrder" WHERE id = ${id} FOR UPDATE`;
      if (!locked.length) throw new AppError(ErrorCodes.NOT_FOUND, 'Purchase order not found.', 404);
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
      const hasReceipts = await tx.goodsReceipt.count({ where: { purchaseOrderId: id } });
      if ((po.status !== 'DRAFT' && po.status !== 'CONFIRMED') || hasReceipts) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Purchase order cannot be cancelled after receiving has started.', 422);
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
      await this.audit.record({ actorUserId, action: 'PURCHASE_ORDER_CANCELLED', entityType: 'PURCHASE_ORDER', entityId: id, branchId: po.branchId }, tx);
    });
    return this.getPurchaseOrder(id);
  }

  async listGoodsReceipts(purchaseOrderId: string) {
    await this.getPurchaseOrder(purchaseOrderId);
    return this.prisma.goodsReceipt.findMany({ where: { purchaseOrderId }, include: { items: { include: { product: true, batch: true } }, receivedBy: { select: { id: true, fullName: true } } }, orderBy: { receivedAt: 'asc' } });
  }

  async receiveGoods(purchaseOrderId: string, dto: CreateGoodsReceiptDto, key: string, actorUserId: string) {
    if (!key?.trim()) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Idempotency-Key is required.', 422);
    if (!dto.items?.length) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Goods receipt must contain at least one item.', 422);
    const requestHash = this.hash({ purchaseOrderId, receipt: dto });
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PurchaseOrder" WHERE id = ${purchaseOrderId} FOR UPDATE`;
      if (!locked.length) throw new AppError(ErrorCodes.NOT_FOUND, 'Purchase order not found.', 404);
      const existing = await tx.idempotencyRecord.findUnique({ where: { scope_key: { scope: 'goods-receipt.create', key } } });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new AppError(ErrorCodes.CONFLICT, 'Idempotency key was already used with a different request.', 409);
        if (existing.status === IdempotencyStatus.COMPLETED && existing.resourceId) {
          const receipt = await tx.goodsReceipt.findUnique({ where: { id: existing.resourceId } });
          if (receipt) return { receiptId: receipt.id, replay: true };
        }
        throw new AppError(ErrorCodes.CONFLICT, 'The idempotent request is already being processed.', 409);
      }
      await tx.idempotencyRecord.create({ data: { key, scope: 'goods-receipt.create', requestHash, status: IdempotencyStatus.PROCESSING } });
      const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: { include: { product: true, productUnit: true } }, warehouse: { include: { inventoryLocation: true } }, supplier: true } });
      if (po.status !== PurchaseOrderStatus.CONFIRMED && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only confirmed or partially received purchase orders can receive goods.', 422);
      const location = po.warehouse.inventoryLocation;
      if (!location || location.status !== 'ACTIVE' || location.type !== 'WAREHOUSE') throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Purchase order warehouse has no active warehouse inventory location.', 422);
      const itemIds = new Set<string>();
      const receiptItems: Array<{ poItem: typeof po.items[number]; dtoItem: CreateGoodsReceiptDto['items'][number]; batchId?: string; baseAccepted: Prisma.Decimal }> = [];
      for (const item of dto.items) {
        if (itemIds.has(item.purchaseOrderItemId)) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'A purchase order item may only appear once per receipt.', 422);
        itemIds.add(item.purchaseOrderItemId);
        const poItem = po.items.find((candidate) => candidate.id === item.purchaseOrderItemId);
        if (!poItem) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Receipt item does not belong to this purchase order.', 422);
        const received = new Prisma.Decimal(item.receivedQuantity);
        const accepted = new Prisma.Decimal(item.acceptedQuantity);
        if (accepted.gt(received)) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Accepted quantity cannot exceed received quantity.', 422);
        const remaining = new Prisma.Decimal(poItem.orderedQuantity).minus(poItem.receivedQuantity);
        if (accepted.gt(remaining)) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Accepted quantity exceeds remaining quantity for ${poItem.product.name}.`, 422);
        let batchId: string | undefined;
        if (poItem.product.isBatchTracked && accepted.gt(0)) {
          if (!item.batchNumber?.trim()) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Batch number is required for ${poItem.product.name}.`, 422);
          const batch = await tx.batch.upsert({
            where: { productId_batchNumber: { productId: poItem.productId, batchNumber: item.batchNumber.trim() } },
            update: { expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined, costPrice: poItem.unitCost },
            create: { productId: poItem.productId, batchNumber: item.batchNumber.trim(), expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined, supplierName: po.supplier.name, costPrice: poItem.unitCost },
          });
          batchId = batch.id;
        }
        const conversion = new Prisma.Decimal(poItem.productUnit.conversionToBase);
        receiptItems.push({ poItem, dtoItem: item, batchId, baseAccepted: accepted.mul(conversion) });
      }
      const receiptId = randomUUID();
      const receiptNumber = `GRN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      await tx.goodsReceipt.create({ data: {
        id: receiptId, receiptNumber, purchaseOrderId: po.id, supplierId: po.supplierId, warehouseId: po.warehouseId,
        branchId: po.branchId, receivedById: actorUserId, idempotencyKey: key, requestHash,
        items: { create: receiptItems.map(({ poItem, dtoItem, batchId }) => ({ purchaseOrderItemId: poItem.id, productId: poItem.productId, productUnitId: poItem.productUnitId, batchId, receivedQuantity: dtoItem.receivedQuantity, acceptedQuantity: dtoItem.acceptedQuantity, rejectedQuantity: new Prisma.Decimal(dtoItem.receivedQuantity).minus(dtoItem.acceptedQuantity), unitCost: poItem.unitCost, expiryDate: dtoItem.expiryDate ? new Date(dtoItem.expiryDate) : undefined })) },
      } });
      for (const { poItem, dtoItem } of receiptItems) {
        await tx.purchaseOrderItem.update({ where: { id: poItem.id }, data: { receivedQuantity: { increment: dtoItem.acceptedQuantity } } });
      }
      const movements = receiptItems.filter(({ dtoItem }) => dtoItem.acceptedQuantity > 0).map(({ poItem, dtoItem, batchId, baseAccepted }) => ({
        locationId: location.id, productId: poItem.productId, batchId, unitId: poItem.productUnit.unitId,
        stockState: 'AVAILABLE' as const, quantityDelta: dtoItem.acceptedQuantity, baseQuantityDelta: baseAccepted.toNumber(),
        movementType: 'PROCUREMENT_RECEIPT' as const, reasonCode: 'GOODS_RECEIPT',
      }));
      await this.ledger.postEvent({ eventType: 'PROCUREMENT_RECEIPT', branchId: po.branchId, referenceType: 'GOODS_RECEIPT', referenceId: receiptId, createdById: actorUserId, idempotencyKey: `goods-receipt-post-${receiptId}`, metadata: { purchaseOrderId: po.id, receiptNumber }, movements }, tx);
      const refreshedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id }, select: { orderedQuantity: true, receivedQuantity: true } });
      const allReceived = refreshedItems.every((item) => new Prisma.Decimal(item.receivedQuantity).gte(item.orderedQuantity));
      const someReceived = refreshedItems.some((item) => new Prisma.Decimal(item.receivedQuantity).gt(0));
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: allReceived ? 'RECEIVED' : someReceived ? 'PARTIALLY_RECEIVED' : 'CONFIRMED' } });
      await tx.idempotencyRecord.update({ where: { scope_key: { scope: 'goods-receipt.create', key } }, data: { status: IdempotencyStatus.COMPLETED, resourceId: receiptId, responseStatus: 201, responseBody: { receiptId }, completedAt: new Date() } });
      await this.audit.record({ actorUserId, action: 'GOODS_RECEIPT_POSTED', entityType: 'GOODS_RECEIPT', entityId: receiptId, branchId: po.branchId, afterData: { purchaseOrderId: po.id, receiptNumber } }, tx);
      return { receiptId, replay: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.getGoodsReceipt(result.receiptId);
  }

  async getGoodsReceipt(id: string) {
    const receipt = await this.prisma.goodsReceipt.findUnique({ where: { id }, include: { supplier: true, warehouse: true, purchaseOrder: true, receivedBy: { select: { id: true, fullName: true } }, items: { include: { product: true, batch: true, productUnit: { include: { unit: true } } } } } });
    if (!receipt) throw new AppError(ErrorCodes.NOT_FOUND, 'Goods receipt not found.', 404);
    return receipt;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
