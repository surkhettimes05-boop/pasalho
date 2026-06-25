import Dexie, { Table } from 'dexie';

export interface LocalProduct {
  id: string;
  skuCode: string;
  barcode: string | null;
  name: string;
  mrp: number;
  categoryId: string;
  brandId: string;
  defaultUnitId: string;
  defaultUnitSymbol: string;
  isBatchTracked: boolean;
  updatedAt: string;
}

export interface LocalRetailer {
  id: string;
  code: string;
  shopName: string;
  ownerName: string;
  address: string | null;
  updatedAt: string;
}

export interface SyncQueueItem {
  id?: number;
  action: 'CREATE_INVOICE';
  payload: any;
  createdAt: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  error?: string;
  retryCount: number;
}

export class PasaloDatabase extends Dexie {
  products!: Table<LocalProduct>;
  retailers!: Table<LocalRetailer>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('PasaloDB');
    this.version(1).stores({
      products: 'id, skuCode, barcode, categoryId, brandId',
      retailers: 'id, code, shopName',
      syncQueue: '++id, action, status, createdAt',
    });
  }
}

export const db = new PasaloDatabase();
