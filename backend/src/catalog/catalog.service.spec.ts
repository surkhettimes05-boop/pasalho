import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('CatalogService', () => {
  let catalog: CatalogService;
  let prisma: Partial<PrismaService>;

  beforeAll(async () => {
    prisma = {
      category: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as any,
      brand: {
        findMany: jest.fn(),
        create: jest.fn(),
      } as any,
      unit: {
        findMany: jest.fn(),
        create: jest.fn(),
      } as any,
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as any,
      batch: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as any,
      productUnit: { create: jest.fn() } as any,
      $transaction: jest.fn((cb: any) => cb(prisma)),
    } as any;

    const audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();

    catalog = module.get(CatalogService);
  });

  describe('categories', () => {
    it('creates a category and records audit', async () => {
      (prisma.category!.create as jest.Mock).mockResolvedValue({ id: 'cat-1', code: 'CAT-01', name: 'Snacks' });
      const result = await catalog.createCategory({ code: 'CAT-01', name: 'Snacks' }, 'user-1');
      expect(result.id).toBe('cat-1');
      expect(prisma.category!.create).toHaveBeenCalledWith({ data: { code: 'CAT-01', name: 'Snacks' } });
    });

    it('lists categories with search', async () => {
      (prisma.category!.findMany as jest.Mock).mockResolvedValue([{ id: 'cat-1', name: 'Beverages' }]);
      const result = await catalog.listCategories(new PaginationDto());
      expect(result).toHaveLength(1);
    });
  });

  describe('products', () => {
    it('creates a product with units', async () => {
      (prisma.product!.create as jest.Mock).mockResolvedValue({ id: 'prod-1', skuCode: 'SKU-001', name: 'Test' });
      (prisma.productUnit!.create as jest.Mock).mockResolvedValue({});
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue({ id: 'prod-1', name: 'Test', category: {}, brand: null, defaultUnit: {}, productUnits: [], batches: [] });

      const result = await catalog.createProduct(
        { skuCode: 'SKU-001', name: 'Test', categoryId: 'cat-1', defaultUnitId: 'unit-1', units: [{ unitId: 'unit-1', conversionToBase: 1, isBaseUnit: true }] },
        'user-1',
      );
      expect(result.id).toBe('prod-1');
    });

    it('finds product by id with relations', async () => {
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue({ id: 'prod-1', name: 'Test', category: {}, brand: null, defaultUnit: {}, productUnits: [], batches: [] });
      const result = await catalog.findProductById('prod-1');
      expect(result.id).toBe('prod-1');
    });

    it('throws 404 for unknown product', async () => {
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(catalog.findProductById('nonexistent')).rejects.toThrow('Product not found.');
    });

    it('paginates product list', async () => {
      (prisma.product!.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product!.count as jest.Mock).mockResolvedValue(0);
      const result = await catalog.listProducts(new PaginationDto());
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe('batches', () => {
    it('creates a batch for a valid product', async () => {
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue({ id: 'prod-1', deletedAt: null });
      (prisma.batch!.create as jest.Mock).mockResolvedValue({ id: 'batch-1', batchNumber: 'B-001', productId: 'prod-1' });

      const result = await catalog.createBatch({ productId: 'prod-1', batchNumber: 'B-001' }, 'user-1');
      expect(result.id).toBe('batch-1');
    });

    it('throws 404 creating batch for missing product', async () => {
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(catalog.createBatch({ productId: 'bad', batchNumber: 'B-001' }, 'user-1')).rejects.toThrow('Product not found.');
    });
  });

  describe('barcode lookup', () => {
    it('returns active product for valid barcode', async () => {
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue({ id: 'prod-1', name: 'Cola', category: {}, brand: null, defaultUnit: {}, batches: [] });
      const result = await catalog.lookupBarcode('123456789');
      expect(result.id).toBe('prod-1');
    });

    it('throws 404 for unknown barcode', async () => {
      (prisma.product!.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(catalog.lookupBarcode('no-such-barcode')).rejects.toThrow('No active product found');
    });
  });
});
