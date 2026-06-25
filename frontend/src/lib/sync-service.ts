import { db, SyncQueueItem } from './db';
import { catalogApi } from './api/catalog';
import { salesApi } from './api/sales';

export class SyncService {
  private static isSyncing = false;

  static async syncCatalog() {
    try {
      console.log('Syncing catalog...');
      const products = await catalogApi.listProducts({ limit: 1000 });
      const retailers = await salesApi.listRetailers({ limit: 1000 });

      await db.transaction('rw', db.products, db.retailers, async () => {
        await db.products.clear();
        await db.products.bulkAdd(products.items.map(p => ({
          id: p.id,
          skuCode: p.skuCode,
          barcode: p.barcode ?? null,
          name: p.name,
          mrp: Number(p.mrp),
          categoryId: p.categoryId,
          brandId: p.brandId ?? null,
          defaultUnitId: p.defaultUnitId,
          defaultUnitSymbol: p.defaultUnit?.symbol || '',
          isBatchTracked: !!p.isBatchTracked,
          updatedAt: p.updatedAt,
        })));

        await db.retailers.clear();
        await db.retailers.bulkAdd(retailers.items.map(r => ({
          id: r.id,
          code: r.code,
          shopName: r.shopName,
          ownerName: r.ownerName,
          address: r.address,
          updatedAt: r.updatedAt,
        })));
      });
      console.log('Catalog synced successfully.');
    } catch (error) {
      console.error('Failed to sync catalog:', error);
    }
  }

  static async processQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pendingItems = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .toArray();

      for (const item of pendingItems) {
        try {
          await db.syncQueue.update(item.id!, { status: 'SYNCING' });
          
          if (item.action === 'CREATE_INVOICE') {
            await salesApi.createInvoice(item.payload);
          }

          await db.syncQueue.delete(item.id!);
          console.log(`Successfully synced item ${item.id}`);
        } catch (error: any) {
          console.error(`Failed to sync item ${item.id}:`, error);
          await db.syncQueue.update(item.id!, {
            status: 'PENDING',
            error: error.message,
            retryCount: (item.retryCount || 0) + 1,
          });
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  static async addToQueue(action: 'CREATE_INVOICE', payload: any) {
    await db.syncQueue.add({
      action,
      payload,
      createdAt: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    });
    this.processQueue();
  }
}
