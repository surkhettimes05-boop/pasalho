import { Injectable } from '@nestjs/common';
import { Prisma, StockState } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { InventoryLedgerService } from '../inventory/services/inventory-ledger.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateFranchisePartnerDto, CreateFranchiseStoreDto, CreateFranchiseSupplyOrderDto } from './franchise.dto';

@Injectable()
export class FranchiseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesOrders: SalesOrderService,
    private readonly inventoryLedger: InventoryLedgerService,
  ) {}

  async overview() {
    const [partners, stores, orders, totals] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "FranchisePartner" WHERE status = 'ACTIVE'`,
      this.prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "FranchiseStore" WHERE status = 'ACTIVE'`,
      this.prisma.$queryRaw<Array<{ status: string; count: number }>>`SELECT status::text, COUNT(*)::int AS count FROM "FranchiseSupplyOrder" GROUP BY status`,
      this.prisma.$queryRaw<Array<{ total: string | null }>>`SELECT SUM("totalAmount")::text AS total FROM "FranchiseSupplyOrder" WHERE status IN ('DISPATCHED','RECEIVED')`,
    ]);
    return { activePartners: partners[0]?.count ?? 0, activeStores: stores[0]?.count ?? 0, ordersByStatus: Object.fromEntries(orders.map((row) => [row.status, row.count])), suppliedValue: totals[0]?.total ? Number(totals[0].total) : null };
  }

  listPartners() {
    return this.prisma.$queryRaw`SELECT id, name, phone, email, status, "createdAt", "updatedAt" FROM "FranchisePartner" ORDER BY name`;
  }

  async createPartner(dto: CreateFranchisePartnerDto) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO "FranchisePartner" (id, name, phone, email, status, "updatedAt")
      VALUES (gen_random_uuid()::text, ${dto.name.trim()}, ${dto.phone.trim()}, ${dto.email?.trim() ?? null}, 'ACTIVE', NOW())
      RETURNING id, name, phone, email, status, "createdAt", "updatedAt"`;
    return rows[0];
  }

  async listAssignableBranches(userId: string) {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId }, select: { branchId: true, warehouseId: true },
    });
    const isGlobalAdmin = assignments.some((assignment) => !assignment.branchId && !assignment.warehouseId);
    const branchIds = new Set(assignments.flatMap((assignment) => assignment.branchId ? [assignment.branchId] : []));
    if (!isGlobalAdmin) {
      const warehouseIds = assignments.flatMap((assignment) => assignment.warehouseId ? [assignment.warehouseId] : []);
      if (warehouseIds.length) {
        const warehouses = await this.prisma.warehouse.findMany({
          where: { id: { in: warehouseIds } }, select: { branchId: true },
        });
        warehouses.forEach((warehouse) => branchIds.add(warehouse.branchId));
      }
    }
    return this.prisma.branch.findMany({
      where: {
        status: 'ACTIVE', deletedAt: null,
        ...(isGlobalAdmin ? {} : { id: { in: [...branchIds] } }),
      },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  listStores() {
    return this.prisma.$queryRaw`
      SELECT s.id, s."partnerId", s."branchId", s."inventoryLocationId", s.name, s.address, s.status, s."createdAt",
        p.name AS "partnerName", p.phone AS "partnerPhone", b.code AS "branchCode", b.name AS "branchName"
      FROM "FranchiseStore" s JOIN "FranchisePartner" p ON p.id = s."partnerId"
      LEFT JOIN "Branch" b ON b.id = s."branchId" ORDER BY p.name, s.name`;
  }

  async createStore(dto: CreateFranchiseStoreDto) {
    const [branch, partner] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: dto.branchId, status: 'ACTIVE', deletedAt: null }, select: { id: true } }),
      this.prisma.franchisePartner.findFirst({ where: { id: dto.partnerId, status: 'ACTIVE' }, select: { id: true } }),
    ]);
    if (!branch) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'A valid active branch is required for a franchise store.', 422);
    if (!partner) throw new AppError(ErrorCodes.NOT_FOUND, 'Active franchise partner not found.', 404);
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO "FranchiseStore" (id, "partnerId", "branchId", name, address, status, "updatedAt")
      VALUES (gen_random_uuid()::text, ${dto.partnerId}, ${dto.branchId}, ${dto.name.trim()}, ${dto.address.trim()}, 'ACTIVE', NOW())
      RETURNING id, "partnerId", "branchId", "inventoryLocationId", name, address, status, "createdAt"`;
    return rows[0];
  }

  async assignStoreBranch(id: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
    if (!branch) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'A valid active branch is required for a franchise store.', 422);
    await this.prisma.$transaction(async (tx) => {
      const stores = await tx.$queryRaw<Array<{ id: string; branchId: string | null; inventoryLocationId: string | null }>>`
        SELECT id, "branchId", "inventoryLocationId" FROM "FranchiseStore" WHERE id = ${id} FOR UPDATE`;
      const store = stores[0];
      if (!store) throw new AppError(ErrorCodes.NOT_FOUND, 'Franchise store not found.', 404);
      if (store.inventoryLocationId && store.branchId !== branchId) {
        throw new AppError(ErrorCodes.CONFLICT, 'A franchise store branch cannot change after its inventory location has been created.', 409);
      }
      await tx.franchiseStore.update({ where: { id }, data: { branchId } });
    });
    return this.getStore(id);
  }

  private async getStore(id: string) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s.id, s."partnerId", s."branchId", s."inventoryLocationId", s.name, s.address, s.status, s."createdAt",
        p.name AS "partnerName", p.phone AS "partnerPhone", b.code AS "branchCode", b.name AS "branchName"
      FROM "FranchiseStore" s JOIN "FranchisePartner" p ON p.id = s."partnerId"
      LEFT JOIN "Branch" b ON b.id = s."branchId" WHERE s.id = ${id}`;
    if (!rows[0]) throw new AppError(ErrorCodes.NOT_FOUND, 'Franchise store not found.', 404);
    return rows[0];
  }

  async listOrders() {
    return this.prisma.$queryRaw`
      SELECT o.id, o."orderNumber", o."storeId", o."salesOrderId", o.status, o."totalAmount", o."requestedById", o."createdAt", o."updatedAt",
        s.name AS "storeName", s.address AS "storeAddress", p.name AS "partnerName",
        so."orderNo" AS "supplyReference",
        COALESCE((SELECT json_agg(json_build_object('id', i.id, 'productId', i."productId", 'sku', pr."skuCode", 'productName', pr.name, 'quantity', i.quantity, 'unit', u.symbol, 'unitPrice', i."unitPrice", 'lineTotal', i."lineTotal")) FROM "FranchiseSupplyOrderItem" i JOIN "Product" pr ON pr.id = i."productId" JOIN "Unit" u ON u.id = i."unitId" WHERE i."orderId" = o.id), '[]'::json) AS items
      FROM "FranchiseSupplyOrder" o JOIN "FranchiseStore" s ON s.id = o."storeId" JOIN "FranchisePartner" p ON p.id = s."partnerId"
      LEFT JOIN "SalesOrder" so ON so.id = o."salesOrderId" ORDER BY o."createdAt" DESC`;
  }

  async getOrder(id: string) {
    const orders = await this.prisma.$queryRaw<Array<any>>`
      SELECT o.id, o."orderNumber", o."storeId", o."salesOrderId", o.status, o."totalAmount", o."requestedById", o."createdAt", o."updatedAt",
        s.name AS "storeName", s.address AS "storeAddress", p.name AS "partnerName", so."orderNo" AS "supplyReference",
        COALESCE((SELECT json_agg(json_build_object('id', i.id, 'productId', i."productId", 'sku', pr."skuCode", 'productName', pr.name, 'quantity', i.quantity, 'unit', u.symbol, 'unitPrice', i."unitPrice", 'lineTotal', i."lineTotal")) FROM "FranchiseSupplyOrderItem" i JOIN "Product" pr ON pr.id = i."productId" JOIN "Unit" u ON u.id = i."unitId" WHERE i."orderId" = o.id), '[]'::json) AS items,
        COALESCE((SELECT json_agg(json_build_object('fromStatus', h."fromStatus", 'toStatus', h."toStatus", 'actorId', h."actorId", 'notes', h.notes, 'createdAt', h."createdAt") ORDER BY h."createdAt") FROM "FranchiseSupplyOrderEvent" h WHERE h."orderId" = o.id), '[]'::json) AS history
      FROM "FranchiseSupplyOrder" o JOIN "FranchiseStore" s ON s.id = o."storeId" JOIN "FranchisePartner" p ON p.id = s."partnerId"
      LEFT JOIN "SalesOrder" so ON so.id = o."salesOrderId" WHERE o.id = ${id}`;
    if (!orders[0]) throw new AppError(ErrorCodes.NOT_FOUND, 'Franchise supply order not found.', 404);
    return orders[0];
  }

  async createSupplyOrder(dto: CreateFranchiseSupplyOrderDto, actorId: string) {
    if (!dto.items.length) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'At least one product is required.', 422);
    if (new Set(dto.items.map((item) => item.productId)).size !== dto.items.length) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Each product can appear once per supply order.', 422);
    const id = await this.prisma.$transaction(async (tx) => {
      const store = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "FranchiseStore" WHERE id = ${dto.storeId} AND status = 'ACTIVE'`;
      if (!store[0]) throw new AppError(ErrorCodes.NOT_FOUND, 'Active franchise store not found.', 404);
      const orderNumber = `FRO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const created = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "FranchiseSupplyOrder" (id, "orderNumber", "storeId", status, "requestedById", "updatedAt")
        VALUES (gen_random_uuid()::text, ${orderNumber}, ${dto.storeId}, 'REQUESTED', ${actorId}, NOW()) RETURNING id`;
      let total = 0;
      let reliableTotal = true;
      for (const item of dto.items) {
        const product = await tx.$queryRaw<Array<{ id: string; unitId: string; price: string | null; active: boolean }>>`
          SELECT id, "defaultUnitId" AS "unitId", "sellingPrice"::text AS price, "isActive" AS active FROM "Product" WHERE id = ${item.productId}`;
        const selected = product[0];
        if (!selected?.active) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Product ${item.productId} is missing or inactive.`, 422);
        const unitId = item.unitId ?? selected.unitId;
        const unit = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "ProductUnit" WHERE "productId" = ${item.productId} AND "unitId" = ${unitId}`;
        if (!unit[0]) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'The selected unit is not valid for this product.', 422);
        const price = selected.price === null ? null : Number(selected.price);
        if (price === null) reliableTotal = false; else total += price * item.quantity;
        await tx.$executeRaw`
          INSERT INTO "FranchiseSupplyOrderItem" (id, "orderId", "productId", "unitId", quantity, "unitPrice", "lineTotal")
          VALUES (gen_random_uuid()::text, ${created[0].id}, ${item.productId}, ${unitId}, ${item.quantity}, ${price}, ${price === null ? null : price * item.quantity})`;
      }
      await tx.$executeRaw`UPDATE "FranchiseSupplyOrder" SET "totalAmount" = ${reliableTotal ? total : null} WHERE id = ${created[0].id}`;
      await tx.$executeRaw`
        INSERT INTO "FranchiseSupplyOrderEvent" (id, "orderId", "toStatus", "actorId", "createdAt")
        VALUES (gen_random_uuid()::text, ${created[0].id}, 'REQUESTED', ${actorId}, NOW())`;
      return created[0].id;
    });
    return this.getOrder(id);
  }

  async transition(id: string, action: 'approve' | 'pick' | 'pack' | 'dispatch' | 'receive', actorId: string) {
    if (action === 'receive') return this.receive(id, actorId);
    const order = await this.getOrder(id);
    if (action === 'approve') {
      if (order.status !== 'REQUESTED') return order;
      const warehouse = await this.prisma.warehouse.findFirst({ where: { status: 'ACTIVE' }, include: { inventoryLocation: true }, orderBy: { createdAt: 'asc' } });
      if (!warehouse?.inventoryLocation || warehouse.inventoryLocation.status !== 'ACTIVE') throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Central Warehouse is not configured with an active inventory location.', 500);
      const lineItems = await this.prisma.$queryRaw<Array<{ productId: string; quantity: string; unitId: string }>>`
        SELECT "productId", quantity::text AS quantity, "unitId" FROM "FranchiseSupplyOrderItem" WHERE "orderId" = ${id} ORDER BY id`;
      const salesOrder = await this.salesOrders.createOnline({
        branchId: warehouse.branchId, salesRepId: actorId, channel: 'FRANCHISE' as any,
        idempotencyKey: `franchise-supply-${id}`, notes: JSON.stringify({ franchiseSupplyOrderId: id }),
        items: lineItems.map((item) => ({ productId: item.productId, unitId: item.unitId, quantity: Number(item.quantity) })),
      } as any, actorId, `franchise-supply-${id}`, { branchId: warehouse.branchId, locationId: warehouse.inventoryLocation.id });
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.$queryRaw<Array<{ status: string }>>`
          UPDATE "FranchiseSupplyOrder" SET status = 'APPROVED', "salesOrderId" = ${salesOrder.id}, "totalAmount" = ${Number(salesOrder.grandTotal)}, "updatedAt" = NOW()
          WHERE id = ${id} AND status = 'REQUESTED' RETURNING status`;
        if (changed[0]) await this.addEvent(tx, id, 'REQUESTED', 'APPROVED', actorId, salesOrder.orderNo);
      });
      return this.getOrder(id);
    }

    const lifecycle = {
      pick: { from: 'APPROVED', to: 'PICKING', sales: 'PICKING' },
      pack: { from: 'PICKING', to: 'PACKED', sales: 'PACKED' },
      dispatch: { from: 'PACKED', to: 'DISPATCHED', sales: 'DISPATCHED' },
    } as const;
    const step = lifecycle[action];
    if (!step) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Unsupported franchise supply action.', 422);
    if (order.status === step.to) return order;
    if (order.status !== step.from || !order.salesOrderId) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Cannot ${action} a supply order in ${order.status}.`, 422);
    await this.salesOrders.updateStatus(order.salesOrderId, step.sales, actorId);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.$queryRaw<Array<{ status: string }>>`
        UPDATE "FranchiseSupplyOrder" SET status = ${step.to}::"FranchiseSupplyStatus", "updatedAt" = NOW()
        WHERE id = ${id} AND status = ${step.from}::"FranchiseSupplyStatus" RETURNING status`;
      if (changed[0]) await this.addEvent(tx, id, step.from, step.to, actorId, null);
    });
    return this.getOrder(id);
  }

  private async receive(id: string, actorId: string) {
    await this.prisma.$transaction(async (tx) => {
      const lockedOrders = await tx.$queryRaw<Array<{
        id: string;
        status: string;
        storeId: string;
        salesOrderId: string | null;
      }>>`
        SELECT id, status::text AS status, "storeId", "salesOrderId"
        FROM "FranchiseSupplyOrder" WHERE id = ${id} FOR UPDATE`;
      const order = lockedOrders[0];
      if (!order) throw new AppError(ErrorCodes.NOT_FOUND, 'Franchise supply order not found.', 404);
      if (order.status === 'RECEIVED') return;
      if (order.status !== 'DISPATCHED' || !order.salesOrderId) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, `Cannot receive a supply order in ${order.status}.`, 422);
      }

      const lockedStores = await tx.$queryRaw<Array<{
        id: string;
        branchId: string | null;
        inventoryLocationId: string | null;
        name: string;
      }>>`
        SELECT id, "branchId", "inventoryLocationId", name
        FROM "FranchiseStore" WHERE id = ${order.storeId} FOR UPDATE`;
      const store = lockedStores[0];
      if (!store) throw new AppError(ErrorCodes.NOT_FOUND, 'Franchise store not found.', 404);
      if (!store.branchId) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'FRANCHISE_BRANCH_REQUIRED: assign a branch to this franchise store before receiving inventory.', 422);
      }

      const branch = await tx.branch.findFirst({
        where: { id: store.branchId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      });
      if (!branch) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'The franchise store must belong to a valid active branch before receiving inventory.', 422);

      const location = await this.ensureInventoryLocation(tx, store);
      const salesOrders = await tx.$queryRaw<Array<{ id: string; status: string; source: string; branchId: string | null }>>`
        SELECT id, status::text AS status, source::text AS source, "branchId"
        FROM "SalesOrder" WHERE id = ${order.salesOrderId} FOR UPDATE`;
      const salesOrder = salesOrders[0];
      if (!salesOrder || salesOrder.source !== 'FRANCHISE' || !['DISPATCHED', 'DELIVERED'].includes(salesOrder.status)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'The linked franchise sales order must be dispatched before receipt.', 422);
      }

      const orderLines = await tx.salesOrderItem.findMany({
        where: { salesOrderId: order.salesOrderId },
        select: { id: true, productId: true, unitId: true, quantity: true, baseQuantity: true },
      });
      const allocations = await tx.stockReservationItem.findMany({
        where: {
          reservation: { salesOrderId: order.salesOrderId, status: 'CONSUMED' },
        },
        include: { product: { select: { isBatchTracked: true } } },
        orderBy: [{ salesOrderItemId: 'asc' }, { batchId: 'asc' }, { id: 'asc' }],
      });
      if (orderLines.length === 0 || allocations.length === 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'The dispatched franchise order has no persisted stock allocations to receive.', 422);
      }

      const allocatedByLine = new Map<string, { quantity: number; baseQuantity: number }>();
      for (const allocation of allocations) {
        const line = orderLines.find((candidate) => candidate.id === allocation.salesOrderItemId);
        if (!line || line.productId !== allocation.productId || line.unitId !== allocation.unitId) {
          throw new AppError(ErrorCodes.CONFLICT, 'Franchise receipt allocation does not match its sales-order line.', 409);
        }
        if (allocation.product.isBatchTracked && !allocation.batchId) {
          throw new AppError(ErrorCodes.CONFLICT, 'A batch-tracked franchise allocation has no batch.', 409);
        }
        const prior = allocatedByLine.get(line.id) ?? { quantity: 0, baseQuantity: 0 };
        prior.quantity += Number(allocation.quantity);
        prior.baseQuantity += Number(allocation.baseQuantity);
        allocatedByLine.set(line.id, prior);
      }
      const quantityMatches = (a: number, b: number) => Math.abs(a - b) < 0.0000001;
      if (orderLines.some((line) => {
        const allocated = allocatedByLine.get(line.id);
        return !allocated ||
          !quantityMatches(allocated.quantity, Number(line.quantity)) ||
          !quantityMatches(allocated.baseQuantity, Number(line.baseQuantity));
      })) {
        throw new AppError(ErrorCodes.CONFLICT, 'Persisted franchise allocations do not equal the dispatched order quantities.', 409);
      }

      await this.inventoryLedger.postEvent({
        eventType: 'FRANCHISE_RECEIPT',
        branchId: store.branchId,
        referenceType: 'FRANCHISE_RECEIPT',
        referenceId: id,
        createdById: actorId,
        idempotencyKey: `franchise-receipt-${id}`,
        metadata: { franchiseStoreId: store.id, salesOrderId: order.salesOrderId, inventoryLocationId: location.id },
        movements: allocations.map((allocation) => ({
          locationId: location.id,
          productId: allocation.productId,
          batchId: allocation.batchId ?? undefined,
          unitId: allocation.unitId,
          stockState: StockState.AVAILABLE,
          quantityDelta: Number(allocation.quantity),
          baseQuantityDelta: Number(allocation.baseQuantity),
          movementType: 'STOCK_IN' as const,
          reasonCode: 'FRANCHISE_SUPPLY_RECEIVED',
        })),
      }, tx);

      if (salesOrder.status === 'DISPATCHED') {
        await tx.salesOrder.update({ where: { id: order.salesOrderId }, data: { status: 'DELIVERED' } });
      }
      const changed = await tx.$queryRaw<Array<{ status: string }>>`
        UPDATE "FranchiseSupplyOrder" SET status = 'RECEIVED', "updatedAt" = NOW()
        WHERE id = ${id} AND status = 'DISPATCHED' RETURNING status`;
      if (!changed[0]) throw new AppError(ErrorCodes.CONFLICT, 'Franchise order status changed during receipt.', 409);
      await this.addEvent(tx, id, 'DISPATCHED', 'RECEIVED', actorId, null);
    });
    return this.getOrder(id);
  }

  private async ensureInventoryLocation(
    tx: Prisma.TransactionClient,
    store: { id: string; branchId: string | null; inventoryLocationId: string | null; name: string },
  ) {
    if (!store.branchId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'FRANCHISE_BRANCH_REQUIRED: assign a branch to this franchise store before receiving inventory.', 422);
    }
    if (store.inventoryLocationId) {
      const location = await tx.inventoryLocation.findUnique({ where: { id: store.inventoryLocationId } });
      if (!location || location.type !== 'FRANCHISE_STORE' || location.branchId !== store.branchId || location.warehouseId !== null) {
        throw new AppError(ErrorCodes.CONFLICT, 'The linked franchise inventory location is invalid or belongs to another branch.', 409);
      }
      if (location.status !== 'ACTIVE') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'The franchise inventory location is inactive.', 422);
      }
      return location;
    }

    const location = await tx.inventoryLocation.create({
      data: {
        branchId: store.branchId,
        code: `FR-${store.id}`,
        name: `Franchise - ${store.name}`,
        type: 'FRANCHISE_STORE',
      },
    });
    await tx.franchiseStore.update({ where: { id: store.id }, data: { inventoryLocationId: location.id } });
    return location;
  }

  private addEvent(tx: any, id: string, fromStatus: string | null, toStatus: string, actorId: string, notes: string | null) {
    return tx.$executeRaw`
      INSERT INTO "FranchiseSupplyOrderEvent" (id, "orderId", "fromStatus", "toStatus", "actorId", notes, "createdAt")
      VALUES (gen_random_uuid()::text, ${id}, ${fromStatus}::"FranchiseSupplyStatus", ${toStatus}::"FranchiseSupplyStatus", ${actorId}, ${notes}, NOW())`;
  }
}
