import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateFranchisePartnerDto, CreateFranchiseStoreDto, CreateFranchiseSupplyOrderDto } from './franchise.dto';

@Injectable()
export class FranchiseService {
  constructor(private readonly prisma: PrismaService, private readonly salesOrders: SalesOrderService) {}

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

  listStores() {
    return this.prisma.$queryRaw`
      SELECT s.id, s."partnerId", s.name, s.address, s.status, s."createdAt", p.name AS "partnerName", p.phone AS "partnerPhone"
      FROM "FranchiseStore" s JOIN "FranchisePartner" p ON p.id = s."partnerId" ORDER BY p.name, s.name`;
  }

  async createStore(dto: CreateFranchiseStoreDto) {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO "FranchiseStore" (id, "partnerId", name, address, status, "updatedAt")
      SELECT gen_random_uuid()::text, p.id, ${dto.name.trim()}, ${dto.address.trim()}, 'ACTIVE', NOW()
      FROM "FranchisePartner" p WHERE p.id = ${dto.partnerId} AND p.status = 'ACTIVE'
      RETURNING id, "partnerId", name, address, status, "createdAt"`;
    if (!rows[0]) throw new AppError(ErrorCodes.NOT_FOUND, 'Active franchise partner not found.', 404);
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
      receive: { from: 'DISPATCHED', to: 'RECEIVED', sales: 'DELIVERED' },
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

  private addEvent(tx: any, id: string, fromStatus: string | null, toStatus: string, actorId: string, notes: string | null) {
    return tx.$executeRaw`
      INSERT INTO "FranchiseSupplyOrderEvent" (id, "orderId", "fromStatus", "toStatus", "actorId", notes, "createdAt")
      VALUES (gen_random_uuid()::text, ${id}, ${fromStatus}::"FranchiseSupplyStatus", ${toStatus}::"FranchiseSupplyStatus", ${actorId}, ${notes}, NOW())`;
  }
}
