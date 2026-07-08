import { Injectable } from '@nestjs/common';
import { BatchStatus, MasterDataStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { UpdateBatchDto } from './dto/update-batch.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ── Categories ───────────────────────────────────────────────────────────────

  listCategories(pagination: PaginationDto) {
    const where = pagination.search
      ? { name: { contains: pagination.search, mode: 'insensitive' as const } }
      : {};
    return this.prisma.category.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto, actorUserId: string) {
    const cat = await this.prisma.category.create({ data: dto });
    await this.audit.record({
      actorUserId,
      action: 'CATEGORY_CREATED',
      entityType: 'PRODUCT',
      entityId: cat.id,
      afterData: { code: cat.code, name: cat.name },
    });
    return cat;
  }

  async updateCategory(
    id: string,
    dto: Partial<CreateCategoryDto> & { status?: MasterDataStatus },
    actorUserId: string,
  ) {
    const cat = await this.prisma.category.update({ where: { id }, data: dto });
    await this.audit.record({
      actorUserId,
      action: 'CATEGORY_UPDATED',
      entityType: 'PRODUCT',
      entityId: id,
      afterData: dto as Prisma.InputJsonValue,
    });
    return cat;
  }

  // ── Brands ───────────────────────────────────────────────────────────────────

  listBrands(pagination: PaginationDto) {
    const where = pagination.search
      ? { name: { contains: pagination.search, mode: 'insensitive' as const } }
      : {};
    return this.prisma.brand.findMany({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { name: 'asc' },
    });
  }

  async createBrand(dto: CreateBrandDto, actorUserId: string) {
    const brand = await this.prisma.brand.create({ data: dto });
    await this.audit.record({
      actorUserId,
      action: 'CATEGORY_CREATED', // reuse closest available; no BRAND_CREATED in schema
      entityType: 'PRODUCT',
      entityId: brand.id,
      afterData: { code: brand.code, name: brand.name },
    });
    return brand;
  }

  // ── Units ────────────────────────────────────────────────────────────────────

  listUnits(pagination: PaginationDto) {
    return this.prisma.unit.findMany({
      skip: pagination.skip,
      take: pagination.limit,
      orderBy: { name: 'asc' },
    });
  }

  async createUnit(dto: CreateUnitDto, actorUserId: string) {
    const unit = await this.prisma.unit.create({ data: dto });
    await this.audit.record({
      actorUserId,
      action: 'UNIT_CREATED',
      entityType: 'PRODUCT',
      entityId: unit.id,
      afterData: { code: unit.code, name: unit.name },
    });
    return unit;
  }

  // ── Products ─────────────────────────────────────────────────────────────────

  async listProducts(
    pagination: PaginationDto,
    categoryId?: string,
    brandId?: string,
  ) {
    const where: Record<string, unknown> = { isActive: true };

    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { skuCode: { contains: pagination.search, mode: 'insensitive' } },
        { barcode: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { category: true, brand: true, defaultUnit: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findProductById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        brand: true,
        defaultUnit: true,
        productUnits: { include: { unit: true } },
        batches: { where: { status: { not: 'EXPIRED' } } },
      },
    });
    if (!product) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found.', 404);
    return product;
  }

  async createProduct(dto: CreateProductDto, actorUserId: string) {
    const { units, ...productData } = dto;

    const product = await this.prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: productData });

      if (units && units.length > 0) {
        for (const u of units) {
          await tx.productUnit.create({
            data: {
              productId: p.id,
              unitId: u.unitId,
              conversionToBase: u.conversionToBase,
              isBaseUnit: u.isBaseUnit,
            },
          });
        }
      }

      return p;
    });

    await this.audit.record({
      actorUserId,
      action: 'PRODUCT_CREATED',
      entityType: 'PRODUCT',
      entityId: product.id,
      afterData: { sku: product.skuCode, name: product.name },
    });

    return this.findProductById(product.id);
  }

  async updateProduct(id: string, dto: UpdateProductDto, actorUserId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found.', 404);

    // Remove `units` from the update payload — product units are managed separately
    const { units, ...updateData } = dto as UpdateProductDto & { units?: unknown };

    const updated = await this.prisma.product.update({ where: { id }, data: updateData });

    await this.audit.record({
      actorUserId,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: id,
      beforeData: { name: existing.name, isActive: existing.isActive },
      afterData: updateData as Prisma.InputJsonValue,
    });

    return updated;
  }

  async deleteProduct(id: string, actorUserId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found.', 404);

    const deleted = await this.prisma.product.update({ 
      where: { id }, 
      data: { deletedAt: new Date(), isActive: false } 
    });

    await this.audit.record({
      actorUserId,
      action: 'PRODUCT_UPDATED', // using UPDATED since there's no PRODUCT_DELETED in enum
      entityType: 'PRODUCT',
      entityId: id,
      beforeData: { isActive: existing.isActive, deletedAt: null },
      afterData: { isActive: false, deletedAt: deleted.deletedAt.toISOString() } as Prisma.InputJsonValue,
    });

    return deleted;
  }

  async adjustStock(id: string, delta: number, actorUserId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found.', 404);

    const newStock = Math.max(0, existing.stock + delta);
    const actualDelta = newStock - existing.stock;

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
    });

    await this.audit.record({
      actorUserId,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: id,
      beforeData: { stock: existing.stock },
      afterData: { stock: updated.stock },
      reason: `Stock adjustment: ${actualDelta > 0 ? '+' : ''}${actualDelta}`,
    });

    return updated;
  }

  // ── Batches ──────────────────────────────────────────────────────────────────

  async listBatches(pagination: PaginationDto, productId?: string) {
    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (pagination.search) {
      where.batchNumber = { contains: pagination.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.batch.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.batch.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findBatchById(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!batch) throw new AppError(ErrorCodes.NOT_FOUND, 'Batch not found.', 404);
    return batch;
  }

  async createBatch(dto: CreateBatchDto, actorUserId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
    });
    if (!product) throw new AppError(ErrorCodes.NOT_FOUND, 'Product not found.', 404);

    const batch = await this.prisma.batch.create({ data: dto });

    await this.audit.record({
      actorUserId,
      action: 'BATCH_CREATED',
      entityType: 'BATCH',
      entityId: batch.id,
      afterData: { productId: batch.productId, batchNumber: batch.batchNumber },
    });

    return batch;
  }

  async updateBatch(id: string, dto: UpdateBatchDto, actorUserId: string) {
    const existing = await this.prisma.batch.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Batch not found.', 404);

    const updated = await this.prisma.batch.update({ where: { id }, data: dto });

    await this.audit.record({
      actorUserId,
      action: 'BATCH_UPDATED',
      entityType: 'BATCH',
      entityId: id,
      beforeData: { status: existing.status },
      afterData: dto as Prisma.InputJsonValue,
    });

    return updated;
  }

  // ── Barcode lookup ───────────────────────────────────────────────────────────

  async lookupBarcode(barcode: string) {
    const now = new Date();

    const product = await this.prisma.product.findFirst({
      where: { barcode, isActive: true },
      include: {
        category: true,
        brand: true,
        defaultUnit: true,
        batches: {
          where: {
            status: BatchStatus.ACTIVE,
            OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
          },
        },
      },
    });

    if (!product) {
      throw new AppError(ErrorCodes.NOT_FOUND, `No active product found for barcode: ${barcode}`, 404);
    }

    return product;
  }
}
