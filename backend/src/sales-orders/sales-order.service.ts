import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import {
  IdempotencyStatus,
  OrderSource,
  Prisma,
  ReferenceType,
  StockReservationStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { PaginationDto } from "../common/dto/pagination.dto";
import { AppError } from "../common/errors/app-error";
import { ErrorCodes } from "../common/errors/error-codes";
import { CreateSalesOrderDto } from "./dto/create-sales-order.dto";
import { ConvertToInvoiceDto } from "./dto/convert-to-invoice.dto";
import { PublicCheckoutDto } from "./dto/public-checkout.dto";
import { InvoiceService } from "../sales/invoice.service";
import { StockReservationService } from "../inventory/services/stock-reservation.service";

@Injectable()
export class SalesOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly invoiceService: InvoiceService,
    private readonly stockReservation: StockReservationService,
  ) {}

  async list(
    pagination: PaginationDto,
    branchId?: string,
    salesRepId?: string,
    status?: string,
    source?: string,
    retailerOrder?: boolean,
  ) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (salesRepId) where.salesRepId = salesRepId;
    if (status) where.status = status;
    if (source) where.source = source;
    if (retailerOrder !== undefined) where.retailerId = retailerOrder ? { not: null } : null;
    if (pagination.search) {
      where.orderNo = { contains: pagination.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          branch: { select: { id: true, name: true } },
          salesRep: {
            include: { user: { select: { id: true, fullName: true } } },
          },
          route: { select: { id: true, name: true, code: true } },
          retailer: {
            select: { id: true, shopName: true, ownerName: true, phone: true },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, status: true, paymentStatus: true, paidAmount: true, grandTotal: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        salesRep: {
          include: { user: { select: { id: true, fullName: true } } },
        },
        route: { select: { id: true, name: true, code: true } },
        retailer: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            grandTotal: true,
          },
        },
        createdBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, skuCode: true } },
            batch: { select: { id: true, batchNumber: true } },
            unit: { select: { id: true, name: true, symbol: true } },
          },
        },
        reservations: {
          include: {
            location: { select: { id: true, code: true, name: true } },
            items: true,
          },
        },
      },
    });
    if (!order)
      throw new AppError(ErrorCodes.NOT_FOUND, "Sales order not found.", 404);
    return order;
  }

  async create(
    dto: CreateSalesOrderDto,
    actorUserId: string,
    idempotencyKey?: string,
    options?: { online?: boolean; branchId?: string; retailerId?: string; locationId?: string },
  ) {
    const online = options?.online === true;
    const branchId = options?.branchId ?? dto.branchId;
    const retailerId = options?.retailerId ?? dto.retailerId;
    const requestKey = idempotencyKey ?? dto.idempotencyKey;
    if (!requestKey) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Idempotency-Key is required.",
        422,
      );
    }

    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          branchId,
          salesRepId: dto.salesRepId,
          routeId: dto.routeId ?? null,
          retailerId,
          channel: dto.channel ?? (online ? OrderSource.STOREFRONT : OrderSource.SALES_REP),
          notes: dto.notes ?? null,
          items: dto.items.map((item) => ({
            productId: item.productId,
            batchId: item.batchId ?? null,
            unitId: item.unitId ?? null,
            quantity: item.quantity,
            notes: item.notes ?? null,
          })),
        }),
      )
      .digest("hex");

    let result: { order: any; created: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const existingKey = await tx.idempotencyRecord.findUnique({
          where: {
            scope_key: { scope: "sales-order.create", key: requestKey },
          },
        });
        if (existingKey) {
          if (existingKey.requestHash !== requestHash) {
            throw new AppError(
              ErrorCodes.CONFLICT,
              "Idempotency key was already used with a different request.",
              409,
            );
          }
          if (
            existingKey.status === IdempotencyStatus.COMPLETED &&
            existingKey.resourceId
          ) {
            const existingOrder = await tx.salesOrder.findUnique({
              where: { id: existingKey.resourceId },
            });
            if (existingOrder) return { order: existingOrder, created: false };
          }
          throw new AppError(
            ErrorCodes.CONFLICT,
            "The idempotent request is already being processed.",
            409,
          );
        }

        await tx.idempotencyRecord.create({
          data: {
            key: requestKey,
            scope: "sales-order.create",
            requestHash,
            status: IdempotencyStatus.PROCESSING,
          },
        });

        const orderNo = `ORD-${Date.now()}-${requestKey.slice(0, 8)}`;

        const [branch, rep, retailer, route, location] = await Promise.all([
          tx.branch.findUnique({ where: { id: branchId } }),
          tx.salesRep.findUnique({
            where: { id: dto.salesRepId },
            include: { user: true },
          }),
          retailerId ? tx.retailer.findUnique({ where: { id: retailerId } }) : null,
          dto.routeId
            ? tx.route.findUnique({ where: { id: dto.routeId } })
            : null,
          tx.inventoryLocation.findFirst({
            where: { branchId, status: "ACTIVE", ...(options?.locationId ? { id: options.locationId } : {}) },
            orderBy: { createdAt: "asc" },
          }),
        ]);
        if (
          !branch ||
          (!online && !retailer) ||
          (retailer && ((retailer.branchId !== branchId && !(online && dto.channel === OrderSource.DNP)) || retailer.status !== "ACTIVE"))
        ) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            "Branch or retailer is invalid or inactive.",
            422,
          );
        }
        if (!online && (
          !rep ||
          rep.branchId !== branchId ||
          rep.status !== "ACTIVE" ||
          rep.userId !== actorUserId
        )) {
          throw new AppError(
            ErrorCodes.FORBIDDEN,
            "The requesting sales representative is not authorized for this branch.",
            403,
          );
        }
        if (!online && (
          !route ||
          route.branchId !== branchId ||
          route.salesRepId !== dto.salesRepId ||
          route.status !== "ACTIVE"
        )) {
          throw new AppError(
            ErrorCodes.FORBIDDEN,
            "The sales representative is not authorized for this route.",
            403,
          );
        }
        const stop = !online && route ? await tx.routeStop.findUnique({
          where: {
            routeId_retailerId: {
              routeId: route.id,
              retailerId,
            },
          },
        }) : true;
        if (!online && !stop)
          throw new AppError(
            ErrorCodes.FORBIDDEN,
            "The retailer is not assigned to this route.",
            403,
          );
        if (!location)
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            "No active inventory location exists for this branch.",
            422,
          );

        const validatedItems: Array<any> = [];
        let subtotal = 0;
        for (const item of dto.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { productUnits: true },
          });
          if (!product || !product.isActive)
            throw new AppError(
              ErrorCodes.VALIDATION_ERROR,
              `Product ${item.productId} is missing or inactive.`,
              422,
            );
          const productUnit = item.unitId
            ? product.productUnits.find((unit) => unit.unitId === item.unitId)
            : (product.productUnits.find((unit) => unit.isBaseUnit) ??
              product.productUnits.find(
                (unit) => unit.unitId === product.defaultUnitId,
              ));
          if (!productUnit)
            throw new AppError(
              ErrorCodes.VALIDATION_ERROR,
              `Unit is not valid for product ${product.name}.`,
              422,
            );
          if (item.batchId) {
            const batch = await tx.batch.findUnique({
              where: { id: item.batchId },
            });
            if (
              !batch ||
              batch.productId !== product.id ||
              batch.status !== "ACTIVE"
            )
              throw new AppError(
                ErrorCodes.VALIDATION_ERROR,
                `Batch is invalid for product ${product.name}.`,
                422,
              );
          }
          const conversionToBase = Number(productUnit.conversionToBase);
          const baseQuantity = item.quantity * conversionToBase;
          const unitPrice = Number(product.sellingPrice ?? 0);
          const lineTotal = item.quantity * unitPrice;
          subtotal += lineTotal;
          validatedItems.push({
            productId: product.id,
            batchId: item.batchId,
            unitId: productUnit.unitId,
            quantity: item.quantity,
            baseQuantity,
            unitPrice,
            discountAmount: 0,
            taxAmount: 0,
            lineTotal,
            notes: item.notes,
          });
        }
        const lockedRetailer = retailerId ? await tx.$queryRaw<
          Array<{ creditLimit: Prisma.Decimal }>
        >`SELECT "creditLimit" FROM "Retailer" WHERE id = ${retailerId} FOR UPDATE` : [];
        const ledger = retailerId ? await tx.retailerLedgerEntry.findMany({
          where: { retailerId },
          select: { debitAmount: true, creditAmount: true },
        }) : [];
        const outstanding = ledger.reduce(
          (total, entry) =>
            total + Number(entry.debitAmount) - Number(entry.creditAmount),
          0,
        );
        if (retailerId && outstanding + subtotal > Number(lockedRetailer[0].creditLimit))
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            `Order exceeds available credit. Remaining: ${Number(lockedRetailer[0].creditLimit) - outstanding}.`,
            422,
          );

        const o = await tx.salesOrder.create({
          data: {
            orderNo,
            source: dto.channel ?? (online ? OrderSource.STOREFRONT : OrderSource.SALES_REP),
            idempotencyKey: requestKey,
            branchId,
            salesRepId: online ? undefined : dto.salesRepId,
            routeId: online ? undefined : dto.routeId,
            retailerId,
            notes: dto.notes,
            status: "CONFIRMED",
            confirmedAt: new Date(),
            subtotal,
            discountTotal: 0,
            taxTotal: 0,
            grandTotal: subtotal,
            createdById: actorUserId,
          },
        });

        const reservation = await tx.stockReservation.create({
          data: {
            salesOrderId: o.id,
            locationId: location.id,
            createdById: actorUserId,
          },
        });

        for (const item of validatedItems) {
          const orderItem = await tx.salesOrderItem.create({
            data: {
              salesOrderId: o.id,
              ...item,
            },
          });
          await this.stockReservation.reserveStock(
            {
              branchId,
              locationId: location.id,
              productId: item.productId,
              batchId: item.batchId,
              unitId: item.unitId,
              quantity: item.quantity,
              baseQuantity: item.baseQuantity,
              referenceType: ReferenceType.SALES_ORDER,
              referenceId: o.id,
              createdById: actorUserId,
              reason: "Sales order reservation",
            },
            tx,
            false,
          );
          await tx.stockReservationItem.create({
            data: {
              reservationId: reservation.id,
              salesOrderItemId: orderItem.id,
              productId: item.productId,
              batchId: item.batchId,
              unitId: item.unitId,
              quantity: item.quantity,
              baseQuantity: item.baseQuantity,
            },
          });
        }

        await tx.idempotencyRecord.update({
          where: {
            id: (
              await tx.idempotencyRecord.findUniqueOrThrow({
                where: {
                  scope_key: { scope: "sales-order.create", key: requestKey },
                },
              })
            ).id,
          },
          data: {
            status: IdempotencyStatus.COMPLETED,
            responseStatus: 201,
            responseBody: { orderId: o.id },
            resourceId: o.id,
            completedAt: new Date(),
          },
        });

        return { order: o, created: true };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingKey = await this.prisma.idempotencyRecord.findUnique({
          where: {
            scope_key: { scope: "sales-order.create", key: requestKey },
          },
        });
        if (existingKey?.requestHash !== requestHash) {
          throw new AppError(
            ErrorCodes.CONFLICT,
            "Idempotency key was already used with a different request.",
            409,
          );
        }
        if (existingKey?.resourceId)
          return this.findById(existingKey.resourceId);
      }
      throw error;
    }

    if (result.created) {
      await this.audit.record({
        actorUserId,
        action: "SALES_ORDER_CREATED",
        entityType: "SALES_ORDER",
        entityId: result.order.id,
        branchId: dto.branchId ?? undefined,
        afterData: {
          orderNo: result.order.orderNo,
          grandTotal: result.order.grandTotal,
        },
      });
    }

    return this.findById(result.order.id);
  }

  async createOnline(
    dto: CreateSalesOrderDto,
    actorUserId: string,
    idempotencyKey: string,
    options: { branchId: string; retailerId?: string; locationId?: string },
  ) {
    return this.create(dto, actorUserId, idempotencyKey, {
      online: true,
      branchId: options.branchId,
      retailerId: options.retailerId,
      locationId: options.locationId,
    });
  }

  async createPublicOrder(dto: PublicCheckoutDto, headerIdempotencyKey?: string) {
    const systemUserId = "99999999-9999-4999-a999-999999999999";
    const idempotencyKey = headerIdempotencyKey ?? dto.idempotencyKey;
    if (!idempotencyKey) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Idempotency-Key is required.", 422);
    }
    const centralWarehouse = await this.prisma.warehouse.findFirst({
      where: { status: "ACTIVE" },
      include: { inventoryLocation: true },
      orderBy: { createdAt: "asc" },
    });
    if (!centralWarehouse?.inventoryLocation || centralWarehouse.inventoryLocation.status !== "ACTIVE") {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Central Warehouse is not configured with an active inventory location.", 500);
    }
    const branchId = centralWarehouse.branchId;

    const notes = JSON.stringify({
      name: `${dto.firstName} ${dto.lastName}`,
      phone: dto.phone,
      address: dto.address,
      externalOrderId: dto.externalOrderId ?? null,
    });
    const order = await this.createOnline(
      {
        branchId,
        salesRepId: systemUserId,
        retailerId: undefined,
        channel: OrderSource.STOREFRONT,
        idempotencyKey,
        notes,
        items: dto.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      } as CreateSalesOrderDto,
      systemUserId,
      idempotencyKey,
      { branchId, locationId: centralWarehouse.inventoryLocation.id },
    );
    if (order.status === "CANCELLED") {
      throw new AppError(ErrorCodes.CONFLICT, "This storefront order was already cancelled.", 409);
    }
    return order;
  }

  async cancelPublicOrder(id: string, actorUserId: string) {
    return this.cancel(id, actorUserId);
  }

  async confirm(id: string, actorUserId: string) {
    const order = await this.findById(id);
    if (order.status !== "DRAFT") {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Only DRAFT orders can be confirmed.",
        422,
      );
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: "SALES_ORDER_CONFIRMED",
      entityType: "SALES_ORDER",
      entityId: id,
      branchId: order.branchId ?? undefined,
      afterData: { status: "CONFIRMED" },
    });

    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: "PICKING" | "PACKED" | "DISPATCHED" | "DELIVERED",
    actorUserId: string,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; source: string; branchId: string | null; retailerId: string | null; invoiceId: string | null }>>`
        SELECT id, status, source, "branchId", "retailerId", "invoiceId"
        FROM "SalesOrder"
        WHERE id = ${id}
        FOR UPDATE
      `;
      const order = rows[0];
      if (!order) throw new AppError(ErrorCodes.NOT_FOUND, "Sales order not found.", 404);
      const franchiseRows = order.source === "FRANCHISE" ? await tx.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM "FranchiseSupplyOrder" WHERE "salesOrderId" = ${id}) AS exists` : [];
      if (order.source !== "STOREFRONT" && !(order.source === "DNP" && order.retailerId) && !(order.source === "FRANCHISE" && franchiseRows[0]?.exists)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, "Only online orders can be progressed via this workflow.", 422);
      }
      if (order.status === status) return order;

      const validTransitions: Record<string, string[]> = {
        CONFIRMED: ["PICKING", "CANCELLED"],
        PLACED: ["PICKING", "CANCELLED"],
        PICKING: ["PACKED", "CANCELLED"],
        PACKED: ["DISPATCHED", "CANCELLED"],
        INVOICED: ["DISPATCHED"],
        DISPATCHED: ["DELIVERED"],
      };
      if (order.source === "DNP" && order.retailerId && status === "DISPATCHED") {
        if (!order.invoiceId) throw new AppError(ErrorCodes.VALIDATION_ERROR, "A posted retailer invoice is required before dispatch.", 422);
        const invoice = await tx.invoice.findUnique({ where: { id: order.invoiceId }, select: { status: true } });
        if (!invoice || !["CREDIT_OPEN", "POSTED"].includes(invoice.status)) {
          throw new AppError(ErrorCodes.VALIDATION_ERROR, "Post the retailer invoice before dispatch.", 422);
        }
      }
      if (!validTransitions[order.status]?.includes(status)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, `Cannot transition order from ${order.status} to ${status}.`, 422);
      }
      if (status === "DISPATCHED" && !(order.source === "DNP" && order.retailerId)) {
        if (!order.branchId) throw new AppError(ErrorCodes.VALIDATION_ERROR, "Online order has no warehouse branch.", 422);
        await this.stockReservation.consumeForOnlineDispatch(tx, {
          salesOrderId: id,
          branchId: order.branchId,
          createdById: actorUserId,
        });
      }
      return tx.salesOrder.update({ where: { id }, data: { status: status as any } });
    });

    await this.audit.record({
      actorUserId,
      action: "SALES_ORDER_CONFIRMED",
      entityType: "SALES_ORDER",
      entityId: id,
      branchId: updated.branchId ?? undefined,
      afterData: { status },
    });

    return this.findById(id);
  }

  async cancel(id: string, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; branchId: string | null }>
      >`SELECT id, status, "branchId" FROM "SalesOrder" WHERE id = ${id} FOR UPDATE`;
      const order = locked[0];
      if (!order)
        throw new AppError(ErrorCodes.NOT_FOUND, "Sales order not found.", 404);
      if (order.status === "CANCELLED") return;
      if (!["DRAFT", "CONFIRMED", "PLACED", "PICKING", "PACKED"].includes(order.status)) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Order cannot be cancelled in its current state.",
          422,
        );
      }

      const reservations = await tx.stockReservation.findMany({
        where: { salesOrderId: id, status: StockReservationStatus.ACTIVE },
        include: { items: true },
      });
      for (const reservation of reservations) {
        for (const item of reservation.items) {
          await this.stockReservation.releaseStock(
            {
              branchId: order.branchId!,
              locationId: reservation.locationId,
              productId: item.productId,
              batchId: item.batchId ?? undefined,
              unitId: item.unitId,
              quantity: Number(item.quantity),
              baseQuantity: Number(item.baseQuantity),
              referenceType: ReferenceType.SALES_ORDER,
              referenceId: id,
              createdById: actorUserId,
              reason: "Sales order cancellation",
            },
            tx,
            false,
          );
        }
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: {
            status: StockReservationStatus.RELEASED,
            releasedAt: new Date(),
          },
        });
      }

      await tx.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await this.audit.record(
        {
          actorUserId,
          action: "SALES_ORDER_CANCELLED",
          entityType: "SALES_ORDER",
          entityId: id,
          branchId: order.branchId ?? undefined,
          afterData: {
            status: "CANCELLED",
            reservationsReleased: reservations.length,
          },
        },
        tx,
      );
    });

    return this.findById(id);
  }

  async convertToInvoice(
    id: string,
    dto: ConvertToInvoiceDto,
    actorUserId: string,
  ) {
    const order = await this.findById(id);

    const centralRetailerOrder = order.source === "DNP" && Boolean(order.retailerId);
    if (order.status !== "CONFIRMED" && !(centralRetailerOrder && order.status === "PACKED")) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Only confirmed orders, or packed central-warehouse retailer orders, can be converted to invoices.",
        422,
      );
    }

    if (order.invoiceId) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        "Order has already been converted to an invoice.",
        409,
      );
    }

    if (!order.branchId) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Cannot convert an order without a branch to an invoice.",
        422,
      );
    }

    // Create invoice from order
    const invoice = await this.invoiceService.create(
      {
        branchId: order.branchId,
        retailerId: order.retailerId,
        warehouseId: dto.warehouseId,
        sourceLocationId: dto.sourceLocationId,
        items: order.items.map((item) => ({
          productId: item.productId,
          batchId: item.batchId ?? undefined,
          unitId: item.unitId,
          quantity: Number(item.quantity),
          baseQuantity: Number(item.baseQuantity),
          unitPrice: Number(item.unitPrice),
          discountAmount: 0,
          taxAmount: 0,
        })),
      },
      actorUserId,
    );

    // Link invoice to order
    await this.prisma.salesOrder.update({
      where: { id },
      data: { status: "INVOICED", invoiceId: invoice.id },
    });

    await this.audit.record({
      actorUserId,
      action: "SALES_ORDER_INVOICED",
      entityType: "SALES_ORDER",
      entityId: id,
      branchId: order.branchId ?? undefined,
      afterData: {
        status: "INVOICED",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return this.findById(id);
  }
}
