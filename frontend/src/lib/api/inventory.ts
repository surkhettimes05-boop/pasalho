import { api, PaginatedResponse } from './client';

export interface InventorySnapshot {
  id: string;
  locationId: string;
  productId: string;
  product: { id: string; name: string; skuCode: string; barcode?: string };
  batchId?: string;
  batch?: { id: string; batchCode: string; expiryDate?: string };
  stockState: string;
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number | string;
  baseQuantity: number | string;
  updatedAt: string;
}

export const inventoryApi = {
  async getLocationStock(locationId: string, page = 1, limit = 50): Promise<PaginatedResponse<InventorySnapshot>> {
    return api.get(`/inventory/locations/${locationId}/stock?page=${page}&limit=${limit}`);
  },
  async getSnapshots(locationId: string, page = 1, limit = 50): Promise<PaginatedResponse<InventorySnapshot>> {
    return api.get(`/inventory/snapshots?locationId=${locationId}&page=${page}&limit=${limit}`);
  },
};
