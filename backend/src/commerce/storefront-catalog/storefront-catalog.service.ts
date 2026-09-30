import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  StorefrontCatalogQueryDto,
  StorefrontSearchQueryDto,
} from './dto/catalog-query.dto';
import { StorefrontAvailabilityService } from './availability.service';
import { StorefrontPricingService } from './pricing.service';

function productIncludeForLocation(
  locationId: string,
): Prisma.StoreProductConfigInclude {
  return {
    product: {
      include: {
        category: true,
        brand: true,
        productGroup: true,
        defaultUnit: true,
        productUnits: true,
        images: { orderBy: { sortOrder: 'asc' as const } },
        snapshots: {
          where: {
            locationId,
            stockState: 'AVAILABLE',
            baseQuantity: { gt: 0 },
          },
          include: { batch: true },
        },
      },
    },
  };
}

@Injectable()
export class StorefrontCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: StorefrontAvailabilityService,
    private readonly pricing: StorefrontPricingService,
  ) {}

  async categories(locationId: string) {
    await this.assertStoreLocation(locationId);
    const configs = await this.prisma.storeProductConfig.findMany({
      where: {
        inventoryLocationId: locationId,
        isVisible: true,
        product: {
          isActive: true,
          storefrontVisible: true,
          deletedAt: null,
          category: { status: 'ACTIVE' },
        },
      },
      include: productIncludeForLocation(locationId),
      orderBy: [{ sortRank: 'asc' }, { product: { name: 'asc' } }],
    });

    const categories = new Map<string, {
      id: string;
      code: string;
      slug: string;
      name: string;
      imageUrl: string | null;
      sortRank: number | null;
    }>();

    for (const config of configs) {
      const card = this.toCard(config);
      if (!card || card.availability.state === 'OUT_OF_STOCK') continue;
      const category = config.product.category;
      categories.set(category.id, {
        id: category.id,
        code: category.code,
        slug: category.slug ?? category.code.toLowerCase(),
        name: category.name,
        imageUrl: category.imageUrl,
        sortRank: category.sortRank,
      });
    }

    return [...categories.values()].sort(
      (a, b) => (a.sortRank ?? 999999) - (b.sortRank ?? 999999) || a.name.localeCompare(b.name),
    );
  }

  async list(query: StorefrontCatalogQueryDto) {
    await this.assertStoreLocation(query.locationId);
    const where: Prisma.StoreProductConfigWhereInput = {
      inventoryLocationId: query.locationId,
      isVisible: true,
      product: {
        isActive: true,
        storefrontVisible: true,
        deletedAt: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.brandId ? { brandId: query.brandId } : {}),
        ...(query.productGroupId ? { productGroupId: query.productGroupId } : {}),
      },
    };

    const [configs, total] = await Promise.all([
      this.prisma.storeProductConfig.findMany({
        where,
        include: productIncludeForLocation(query.locationId),
        orderBy: [{ sortRank: 'asc' }, { product: { name: 'asc' } }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.storeProductConfig.count({ where }),
    ]);

    let products = configs.map((config) => this.toCard(config)).filter(Boolean);
    if (query.sort === 'PRICE_ASC') {
      products = products.sort((a, b) => a!.price.sellingPrice - b!.price.sellingPrice);
    } else if (query.sort === 'PRICE_DESC') {
      products = products.sort((a, b) => b!.price.sellingPrice - a!.price.sellingPrice);
    }

    return {
      items: products,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async search(query: StorefrontSearchQueryDto) {
    const normalized = query.q.trim();
    if (!normalized) return { items: [], total: 0, page: query.page, limit: query.limit, zeroResult: true };

    await this.assertStoreLocation(query.locationId);
    const where: Prisma.StoreProductConfigWhereInput = {
      inventoryLocationId: query.locationId,
      isVisible: true,
      product: {
        isActive: true,
        storefrontVisible: true,
        deletedAt: null,
        OR: [
          { name: { contains: normalized, mode: 'insensitive' } },
          { skuCode: { contains: normalized, mode: 'insensitive' } },
          { slug: { contains: normalized, mode: 'insensitive' } },
          { brand: { name: { contains: normalized, mode: 'insensitive' } } },
          { category: { name: { contains: normalized, mode: 'insensitive' } } },
        ],
      },
    };

    const [configs, total] = await Promise.all([
      this.prisma.storeProductConfig.findMany({
        where,
        include: productIncludeForLocation(query.locationId),
        orderBy: [{ sortRank: 'asc' }, { product: { name: 'asc' } }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.storeProductConfig.count({ where }),
    ]);

    const items = configs.map((config) => this.toCard(config)).filter(Boolean);
    return { items, total, page: query.page, limit: query.limit, zeroResult: total === 0 };
  }

  async detail(identifier: string, locationId: string) {
    await this.assertStoreLocation(locationId);
    const config = await this.prisma.storeProductConfig.findFirst({
      where: {
        inventoryLocationId: locationId,
        isVisible: true,
        product: {
          isActive: true,
          storefrontVisible: true,
          deletedAt: null,
          OR: [{ slug: identifier }, { skuCode: identifier }, { id: identifier }],
        },
      },
      include: productIncludeForLocation(locationId),
    });
    if (!config) throw new AppError(ErrorCodes.NOT_FOUND, 'Storefront product not found.', 404);

    const selected = this.toCard(config);
    if (!selected) throw new AppError(ErrorCodes.PRODUCT_NOT_ORDERABLE, 'Product has no valid selling price.', 422);

    const variants = config.product.productGroupId
      ? await this.prisma.storeProductConfig.findMany({
          where: {
            inventoryLocationId: locationId,
            isVisible: true,
            product: {
              productGroupId: config.product.productGroupId,
              isActive: true,
              storefrontVisible: true,
              deletedAt: null,
            },
          },
          include: productIncludeForLocation(locationId),
          orderBy: [{ sortRank: 'asc' }, { product: { name: 'asc' } }],
        })
      : [config];

    return {
      ...selected,
      description: config.product.description,
      shortDescription: config.product.shortDescription,
      productGroup: config.product.productGroup,
      images: config.product.images.length
        ? config.product.images.map((image) => ({ url: image.url, altText: image.altText }))
        : config.product.imageUrl
          ? [{ url: config.product.imageUrl, altText: config.product.name }]
          : [],
      variants: variants.map((variant) => this.toCard(variant)).filter(Boolean),
    };
  }

  async getOrderableProduct(locationId: string, productId: string, unitId: string) {
    await this.assertStoreLocation(locationId);
    const config = await this.prisma.storeProductConfig.findFirst({
      where: {
        inventoryLocationId: locationId,
        productId,
        isVisible: true,
        product: { isActive: true, storefrontVisible: true, deletedAt: null },
      },
      include: productIncludeForLocation(locationId),
    });
    if (!config) throw new AppError(ErrorCodes.PRODUCT_NOT_ORDERABLE, 'Product is not orderable at this store.', 422);

    const productUnit = config.product.productUnits.find((candidate) => candidate.unitId === unitId);
    if (!productUnit && config.product.defaultUnitId !== unitId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Unit is not valid for this product.', 422);
    }

    const price = this.pricing.resolve(config.product, config);
    if (!price) throw new AppError(ErrorCodes.PRODUCT_NOT_ORDERABLE, 'Product has no valid selling price.', 422);

    const availability = this.availability.calculate({
      snapshots: config.product.snapshots,
      safetyStockBaseQty: config.safetyStockBaseQty,
      maxOrderBaseQty: config.maxOrderBaseQty,
      defaultUnitId: unitId,
      productUnits: config.product.productUnits,
    });

    const conversionToBase = Number(productUnit?.conversionToBase ?? 1);
    return {
      config,
      product: config.product,
      price,
      availability,
      conversionToBase,
    };
  }

  private async assertStoreLocation(locationId: string) {
    const location = await this.prisma.inventoryLocation.findFirst({
      where: {
        id: locationId,
        type: 'STORE',
        status: 'ACTIVE',
        branch: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, branchId: true, name: true },
    });
    if (!location) {
      throw new AppError(
        ErrorCodes.FULFILLMENT_LOCATION_UNAVAILABLE,
        'Fulfillment store is unavailable.',
        422,
      );
    }
    return location;
  }

  private toCard(config: any) {
    const price = this.pricing.resolve(config.product, config);
    if (!price) return null;

    const availability = this.availability.calculate({
      snapshots: config.product.snapshots,
      safetyStockBaseQty: config.safetyStockBaseQty,
      maxOrderBaseQty: config.maxOrderBaseQty,
      defaultUnitId: config.product.defaultUnitId,
      productUnits: config.product.productUnits,
    });

    const product = config.product;
    return {
      id: product.id,
      productGroupId: product.productGroupId,
      slug: product.slug ?? product.skuCode,
      skuCode: product.skuCode,
      name: product.name,
      packLabel: product.defaultUnit.symbol,
      defaultUnitId: product.defaultUnitId,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug ?? product.category.code.toLowerCase(),
      },
      brand: product.brand
        ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug ?? product.brand.code.toLowerCase() }
        : null,
      imageUrl: product.images[0]?.url ?? product.imageUrl,
      price,
      availability: {
        state: availability.state,
        maxOrderQuantity: availability.maxOrderQuantity,
      },
    };
  }
}
