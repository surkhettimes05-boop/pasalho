import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { AuditLogService } from "../../audit/audit-log.service";
import { InventoryLedgerService } from "./inventory-ledger.service";
import { CreateStockTransferDto } from "../dto/create-stock-transfer.dto";
import { AppError } from "../../common/errors/app-error";
import { ErrorCodes } from "../../common/errors/error-codes";
import { IdempotencyStatus, Prisma, StockTransferStatus } from "@prisma/client";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { AcknowledgeStoreReceiptDto } from "../dto/acknowledge-store-receipt.dto";

@Injectable()
export class StockTransferService {
  private readonly logger = new Logger(StockTransferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly inventoryLedger: InventoryLedgerService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = {};
    if (branchId) {
      where.OR = [{ fromBranchId: branchId }, { toBranchId: branchId }];
    }

    if (pagination.search) {
      where.transferNo = { contains: pagination.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          items: {
            select: {
              id: true,
              quantity: true,
              product: { select: { name: true, skuCode: true } },
              unit: { select: { symbol: true } },
            },
          },
          fromBranch: true,
          toBranch: true,
          fromWarehouse: true,
          toWarehouse: true,
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
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
        dispatchedBy: { select: { id: true, fullName: true } },
        receivedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!transfer)
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        "Stock transfer not found.",
        404,
      );
    return transfer;
  }

  async create(
    dto: CreateStockTransferDto,
    actorUserId: string,
    idempotencyKey?: string,
  ) {
    const transferNo = `TRF-${Date.now()}`;
    const requestHash = this.hash({ ...dto, items: dto.items });

    const transfer = await this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.idempotencyRecord.findUnique({
          where: {
            scope_key: { scope: "stock-transfer.create", key: idempotencyKey },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new AppError(
              ErrorCodes.CONFLICT,
              "Idempotency key was already used with a different request.",
              409,
            );
          }
          if (
            existing.status === IdempotencyStatus.COMPLETED &&
            existing.resourceId
          ) {
            return tx.stockTransfer.findUniqueOrThrow({
              where: { id: existing.resourceId },
            });
          }
          throw new AppError(
            ErrorCodes.CONFLICT,
            "The idempotent request is already being processed.",
            409,
          );
        }
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            scope: "stock-transfer.create",
            requestHash,
            status: IdempotencyStatus.PROCESSING,
          },
        });
      }

      const [
        fromBranch,
        toBranch,
        fromWarehouse,
        toWarehouse,
        fromLocation,
        toLocation,
        productCount,
      ] = await Promise.all([
        tx.branch.findUnique({ where: { id: dto.fromBranchId } }),
        tx.branch.findUnique({ where: { id: dto.toBranchId } }),
        tx.warehouse.findUnique({ where: { id: dto.fromWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: dto.toWarehouseId } }),
        tx.inventoryLocation.findUnique({ where: { id: dto.fromLocationId } }),
        tx.inventoryLocation.findUnique({ where: { id: dto.toLocationId } }),
        tx.product.count({
          where: { id: { in: dto.items.map((item) => item.productId) } },
        }),
      ]);
      if (
        !fromBranch ||
        !toBranch ||
        !fromWarehouse ||
        !toWarehouse ||
        !fromLocation ||
        !toLocation ||
        fromWarehouse.branchId !== fromBranch.id ||
        toWarehouse.branchId !== toBranch.id ||
        fromLocation.branchId !== fromBranch.id ||
        fromLocation.warehouseId !== fromWarehouse.id ||
        toLocation.branchId !== toBranch.id ||
        (toLocation.type !== "STORE" &&
          toLocation.warehouseId !== toWarehouse.id) ||
        productCount !== new Set(dto.items.map((item) => item.productId)).size
      ) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Transfer contains an invalid branch, warehouse, location, or product.",
          422,
        );
      }

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
          externalReference: dto.externalReference,
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
            stockState: item.stockState || "AVAILABLE",
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
          },
        });
      }

      if (idempotencyKey) {
        await tx.idempotencyRecord.update({
          where: {
            scope_key: { scope: "stock-transfer.create", key: idempotencyKey },
          },
          data: {
            status: IdempotencyStatus.COMPLETED,
            resourceId: trf.id,
            completedAt: new Date(),
            responseStatus: 201,
          },
        });
      }

      return trf;
    });

    await this.audit.record({
      actorUserId,
      action: "STOCK_TRANSFER_CREATED",
      entityType: "STOCK_TRANSFER",
      entityId: transfer.id,
      branchId: dto.fromBranchId,
      afterData: {
        transferNo,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
      },
    });

    return this.findById(transfer.id);
  }

  async confirm(id: string, actorUserId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockTransfer(tx, id);
      const transfer = await tx.stockTransfer.findUniqueOrThrow({
        where: { id },
      });
      if (transfer.status === StockTransferStatus.CONFIRMED) return transfer;
      if (transfer.status !== StockTransferStatus.DRAFT) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Only DRAFT transfers can be confirmed.",
          422,
        );
      }
      return tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.CONFIRMED },
      });
    });
    await this.audit.record({
      actorUserId,
      action: "STOCK_TRANSFER_CONFIRMED",
      entityType: "STOCK_TRANSFER",
      entityId: id,
      afterData: { status: StockTransferStatus.CONFIRMED },
    });
    return this.findById(updated.id);
  }

  async dispatch(id: string, actorUserId: string, idempotencyKey?: string) {
    this.requireIdempotencyKey(idempotencyKey);
    const requestHash = this.hash({ transferId: id, action: "dispatch" });
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockTransfer(tx, id);
      const transfer = await tx.stockTransfer.findUniqueOrThrow({
        where: { id },
        include: { items: true, toBranch: true },
      });
      if (
        transfer.status === StockTransferStatus.IN_TRANSIT ||
        transfer.status === StockTransferStatus.SHIPPED ||
        transfer.status === StockTransferStatus.RECEIVED
      )
        return transfer;
      if (transfer.status !== StockTransferStatus.CONFIRMED) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Only CONFIRMED transfers can be dispatched.",
          422,
        );
      }
      await this.beginIdempotency(
        tx,
        "stock-transfer.dispatch",
        idempotencyKey,
        requestHash,
      );

      await this.inventoryLedger.postEvent(
        {
          eventType: "STOCK_TRANSFER",
          branchId: transfer.fromBranchId,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          createdById: actorUserId,
          idempotencyKey: `transfer-dispatch-${transfer.id}`,
          movements: transfer.items.flatMap((item) => [
            {
              locationId: transfer.fromLocationId,
              productId: item.productId,
              batchId: item.batchId || undefined,
              unitId: item.unitId,
              stockState: "AVAILABLE",
              quantityDelta: -Number(item.quantity),
              baseQuantityDelta: -Number(item.baseQuantity),
              movementType: "TRANSFER_OUT",
              reasonCode: "TRANSFER_SHIP_OUT",
            },
            {
              locationId: transfer.fromLocationId,
              productId: item.productId,
              batchId: item.batchId || undefined,
              unitId: item.unitId,
              stockState: "IN_TRANSIT",
              quantityDelta: Number(item.quantity),
              baseQuantityDelta: Number(item.baseQuantity),
              movementType: "TRANSFER_OUT",
              reasonCode: "TRANSFER_IN_TRANSIT",
            },
          ]),
        },
        tx,
      );

      const result = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.IN_TRANSIT,
          dispatchedById: actorUserId,
          dispatchedAt: new Date(),
          shippedById: actorUserId,
          shippedAt: new Date(),
        },
      });
      await this.ensureStoreSyncOutbox(tx, transfer, actorUserId);
      await this.completeIdempotency(
        tx,
        "stock-transfer.dispatch",
        idempotencyKey,
        result.id,
      );
      return result;
    });

    await this.audit.record({
      actorUserId,
      action: "STOCK_TRANSFER_DISPATCHED",
      entityType: "STOCK_TRANSFER",
      entityId: id,
      afterData: { status: StockTransferStatus.IN_TRANSIT },
    });
    const result = await this.findById(updated.id);
    await this.notifyStoreSync(result, actorUserId);
    return result;
  }

  async ship(id: string, actorUserId: string, idempotencyKey?: string) {
    return this.dispatch(id, actorUserId, idempotencyKey);
  }

  async acknowledgeStoreReceipt(
    id: string,
    dto: AcknowledgeStoreReceiptDto,
    idempotencyKey?: string,
  ) {
    this.requireIdempotencyKey(idempotencyKey);
    const requestHash = this.hash({ transferId: id, action: "store-receipt", ...dto });
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockTransfer(tx, id);
      const transfer = await tx.stockTransfer.findUniqueOrThrow({
        where: { id },
        include: { items: true, toBranch: true },
      });
      if (
        transfer.status !== StockTransferStatus.RECEIVED &&
        transfer.status !== StockTransferStatus.IN_TRANSIT &&
        transfer.status !== StockTransferStatus.SHIPPED
      ) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Only IN_TRANSIT transfers can be received.",
          422,
        );
      }
      if (transfer.toBranch.code !== dto.destinationBranchCode) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          "Receipt destination does not match the transfer destination.",
          422,
        );
      }
      const expected = new Map<string, number>();
      for (const item of transfer.items) {
        expected.set(item.productId, (expected.get(item.productId) ?? 0) + Number(item.quantity));
      }
      const received = new Map<string, number>();
      for (const item of dto.items) {
        if (received.has(item.productId)) {
          throw new AppError(ErrorCodes.VALIDATION_ERROR, "Receipt contains a duplicate product.", 422);
        }
        received.set(item.productId, item.quantity);
      }
      const exact = received.size === expected.size && [...expected.entries()].every(
        ([productId, quantity]) => received.get(productId) === quantity,
      );
      if (!exact) {
        throw new AppError(
          ErrorCodes.CONFLICT,
          "Received quantities must exactly match the dispatched transfer.",
          409,
        );
      }
      if (transfer.status === StockTransferStatus.RECEIVED) return transfer;
      await this.beginIdempotency(
        tx,
        "stock-transfer.store-receipt",
        idempotencyKey,
        requestHash,
      );

      // CEO Dashboard already posted store AVAILABLE stock atomically with the
      // physical receipt. PASALO only clears its in-transit custody here.
      await this.inventoryLedger.postEvent(
        {
          eventType: "STOCK_TRANSFER",
          branchId: transfer.fromBranchId,
          referenceType: "STOCK_TRANSFER",
          referenceId: transfer.id,
          createdById: transfer.dispatchedById ?? transfer.createdById,
          idempotencyKey: `transfer-receive-origin-${transfer.id}`,
          movements: transfer.items.map((item) => ({
            locationId: transfer.fromLocationId,
            productId: item.productId,
            batchId: item.batchId || undefined,
            unitId: item.unitId,
            stockState: "IN_TRANSIT",
            quantityDelta: -Number(item.quantity),
            baseQuantityDelta: -Number(item.baseQuantity),
            movementType: "TRANSFER_IN",
            reasonCode: "STORE_RECEIPT_ACKNOWLEDGED",
          })),
        },
        tx,
      );

      await Promise.all(transfer.items.map((item) => tx.stockTransferItem.update({
        where: { id: item.id },
        data: {
          receivedQuantity: item.quantity,
          receivedBaseQuantity: item.baseQuantity,
          varianceQuantity: 0,
          varianceBaseQuantity: 0,
        },
      })));

      const result = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.RECEIVED,
          receivedAt: new Date(),
        },
      });
      await this.completeIdempotency(
        tx,
        "stock-transfer.store-receipt",
        idempotencyKey,
        result.id,
      );
      return result;
    });

    await this.audit.record({
      actorUserId: updated.dispatchedById ?? updated.createdById,
      action: "STOCK_TRANSFER_RECEIVED",
      entityType: "STOCK_TRANSFER",
      entityId: id,
      afterData: { status: StockTransferStatus.RECEIVED },
    });
    return this.findById(updated.id);
  }

  async retryStoreSync(id: string, actorUserId: string) {
    const transfer = await this.findById(id);
    if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Only in-transit transfers can retry store synchronization.",
        409,
      );
    }
    const event = await this.prisma.inventoryEvent.findUnique({
      where: { idempotencyKey: `store-sync-${transfer.id}` },
    });
    const metadata = (event?.metadata ?? {}) as Record<string, any>;
    if (
      !event ||
      event.eventStatus !== "DRAFT" ||
      metadata.status !== "PENDING" ||
      !metadata.payload ||
      !metadata.payloadHash
    ) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        "No pending store synchronization event is available to retry.",
        409,
      );
    }
    const retryMetadata = {
      ...metadata,
      payloadHash: this.hashCanonical(metadata.payload),
    };
    await this.prisma.inventoryEvent.update({
      where: { id: event.id },
      data: { metadata: retryMetadata },
    });
    await this.deliverStoreSync(event, retryMetadata);
    return this.findById(id);
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private canonicalJson(value: any): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonicalJson(item)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.canonicalJson(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  private hashCanonical(value: unknown) {
    return createHash("sha256").update(this.canonicalJson(value)).digest("hex");
  }

  private async lockTransfer(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "StockTransfer" WHERE id = ${id} FOR UPDATE`;
    if (!rows[0])
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        "Stock transfer not found.",
        404,
      );
  }

  private async beginIdempotency(
    tx: Prisma.TransactionClient,
    scope: string,
    key: string,
    requestHash: string,
  ) {
    const existing = await tx.idempotencyRecord.findUnique({
      where: { scope_key: { scope, key } },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new AppError(
          ErrorCodes.CONFLICT,
          "Idempotency key was already used with a different request.",
          409,
        );
      if (existing.status === IdempotencyStatus.COMPLETED) return;
      throw new AppError(
        ErrorCodes.CONFLICT,
        "The idempotent request is already being processed.",
        409,
      );
    }
    await tx.idempotencyRecord.create({
      data: { scope, key, requestHash, status: IdempotencyStatus.PROCESSING },
    });
  }

  private async completeIdempotency(
    tx: Prisma.TransactionClient,
    scope: string,
    key: string,
    resourceId: string,
  ) {
    await tx.idempotencyRecord.update({
      where: { scope_key: { scope, key } },
      data: {
        status: IdempotencyStatus.COMPLETED,
        resourceId,
        responseStatus: 200,
        completedAt: new Date(),
      },
    });
  }

  private requireIdempotencyKey(key?: string): asserts key is string {
    if (!key) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        "Idempotency-Key is required for transfer state changes.",
        422,
      );
    }
  }

  private async ensureStoreSyncOutbox(
    tx: Prisma.TransactionClient,
    transfer: any,
    actorUserId: string,
  ) {
    const payload = this.storeSyncPayload(transfer);
    const event = await tx.inventoryEvent.create({
      data: {
        eventType: "STOCK_TRANSFER",
        eventStatus: "DRAFT",
        branchId: transfer.toBranchId,
        referenceType: "STOCK_TRANSFER",
        referenceId: transfer.id,
        idempotencyKey: `store-sync-${transfer.id}`,
        createdById: actorUserId,
        metadata: {
          type: "STORE_SYNC_WEBHOOK",
          status: "PENDING",
          url: process.env.STORE_SYNC_WEBHOOK_URL ?? null,
          payload: {
            ...payload,
            eventId: undefined,
          },
        },
      },
    });
    const eventPayload = {
      ...payload,
      eventId: event.id,
      occurredAt: event.occurredAt.toISOString(),
    };
    await tx.inventoryEvent.update({
      where: { id: event.id },
      data: {
        metadata: {
          type: "STORE_SYNC_WEBHOOK",
          status: "PENDING",
          url: process.env.STORE_SYNC_WEBHOOK_URL ?? null,
          payload: eventPayload,
        payloadHash: this.hashCanonical(eventPayload),
        },
      },
    });
  }

  private storeSyncPayload(transfer: any, event?: any) {
    return {
      transferId: transfer.id,
      transferNo: transfer.transferNo,
      destinationBranchCode: transfer.toBranch.code,
      ...(event ? { occurredAt: event.occurredAt.toISOString() } : {}),
      items: transfer.items.map((item: any) => ({
        productId: item.productId,
        quantity:
          Number(item.quantity),
      })),
      idempotencyKey: transfer.id,
    };
  }

  private async notifyStoreSync(
    transfer: any,
    _actorUserId: string,
  ): Promise<void> {
    const event = await this.prisma.inventoryEvent.findUnique({
      where: { idempotencyKey: `store-sync-${transfer.id}` },
    });
    if (!event || event.eventStatus === "POSTED") return;

    const metadata = (event.metadata ?? {}) as Record<string, any>;
    const webhookUrl = process.env.STORE_SYNC_WEBHOOK_URL ?? metadata.url;

    // Rebuild only on first delivery after dispatch. Retry uses the
    // persisted payload and event identity without recalculating the event.
    const payload = {
      ...this.storeSyncPayload(transfer, event),
      eventId: event.id,
    };
    const payloadHash = this.hashCanonical(payload);
    const deliveryMetadata = { ...metadata, payload, payloadHash };
    await this.prisma.inventoryEvent.update({
      where: { id: event.id },
      data: { metadata: deliveryMetadata },
    });
    if (!webhookUrl) {
      this.logger.warn(
        `Inbound transfer registration remains pending for transfer ${transfer.id}: STORE_SYNC_WEBHOOK_URL is not configured.`,
      );
      return;
    }
    await this.deliverStoreSync(event, { ...deliveryMetadata, url: webhookUrl });
  }

  private async deliverStoreSync(event: any, metadata: Record<string, any>) {
    const webhookUrl = process.env.STORE_SYNC_WEBHOOK_URL ?? metadata.url;
    if (!webhookUrl) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        "Pending store synchronization has no configured destination URL.",
        502,
      );
    }
    const payload = metadata.payload;
    const payloadHash = this.hashCanonical(payload);
    const timeoutMs = Number(process.env.STORE_SYNC_WEBHOOK_TIMEOUT_MS ?? 5000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-event-id": event.id,
          "x-payload-sha256": payloadHash,
          ...(process.env.STORE_SYNC_WEBHOOK_SECRET
            ? {
                "x-pasalo-webhook-secret":
                  process.env.STORE_SYNC_WEBHOOK_SECRET,
              }
            : {}),
        },
        body: this.canonicalJson(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`ceodashboard returned HTTP ${response.status}`);
      }
      await this.prisma.inventoryEvent.update({
        where: { id: event.id },
        data: {
          eventStatus: "POSTED",
          metadata: {
            ...metadata,
            status: "SENT",
            sentAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Inbound transfer registration failed for transfer ${event.referenceId}: ${message}`,
      );
      await this.prisma.inventoryEvent.update({
        where: { id: event.id },
        data: {
          eventStatus: "DRAFT",
          metadata: {
            ...metadata,
            status: "PENDING",
            url: webhookUrl,
            error: message,
          },
        },
      });
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        `Transfer dispatched but inbound registration is pending: ${message}`,
        502,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
