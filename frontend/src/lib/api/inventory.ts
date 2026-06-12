import { api, PaginatedResponse } from './client';

export interface InventorySnapshot {
  id: string;
  locationId: string;
  warehouseId?: string;
  productId: string;
  product: { id: string; name: string; skuCode: string; barcode?: string };
  batchId?: string;
  batch?: { id: string; batchCode: string; expiryDate?: string };
  stockState: string;
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number | string;
  baseQuantity: number | string;
  /** Some backend responses include a reserved quantity. Optional. */
  reservedQuantity?: number | string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  product?: { id: string; name: string; skuCode: string };
  warehouseId?: string;
  locationId?: string;
  movementType: string;
  quantityDelta: number | string;
  baseQuantityDelta?: number | string;
  unitId?: string;
  unit?: { id: string; name: string; symbol: string };
  reason?: string;
  reasonCode?: string;
  referenceType?: string;
  referenceId?: string;
  batchId?: string;
  batch?: { id: string; batchCode: string };
  createdAt: string;
  createdBy?: { id: string; fullName: string };
}

export type StockAdjustmentStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'POSTED'
  | 'CANCELLED';

export interface StockAdjustment {
  id: string;
  referenceNumber?: string;
  branchId?: string;
  warehouseId: string;
  warehouse?: { id: string; name: string; code: string };
  productId?: string;
  product?: { id: string; name: string; skuCode: string };
  batchId?: string;
  batch?: { id: string; batchCode: string };
  unitId?: string;
  unit?: { id: string; name: string; symbol: string };
  quantityDelta: number | string;
  reasonCode: string;
  reason?: string;
  status: StockAdjustmentStatus;
  notes?: string;
  createdBy?: { id: string; fullName: string };
  createdAt: string;
  postedAt?: string;
}

export const inventoryApi = {
  async getLocationStock(
    locationId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<InventorySnapshot>> {
    return api.get(
      `/inventory/locations/${locationId}/stock?page=${page}&limit=${limit}`,
    );
  },

  /**
   * Fetch inventory snapshots. The backend accepts either a warehouseId
   * (high-level) or locationId (low-level) filter. We pass both when known so
   * whichever the backend honours will narrow the result set.
   */
  async getSnapshots(params?: {
    warehouseId?: string;
    locationId?: string;
    productId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<InventorySnapshot>> {
    const q = new URLSearchParams();
    if (params?.warehouseId) q.set('warehouseId', params.warehouseId);
    if (params?.locationId) q.set('locationId', params.locationId);
    if (params?.productId) q.set('productId', params.productId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/snapshots?${q.toString()}`);
  },

  async getMovements(params?: {
    productId?: string;
    warehouseId?: string;
    locationId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<InventoryMovement>> {
    const q = new URLSearchParams();
    if (params?.productId) q.set('productId', params.productId);
    if (params?.warehouseId) q.set('warehouseId', params.warehouseId);
    if (params?.locationId) q.set('locationId', params.locationId);
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/movements?${q.toString()}`);
  },

  async listAdjustments(params?: {
    status?: StockAdjustmentStatus;
    warehouseId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<StockAdjustment>> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.warehouseId) q.set('warehouseId', params.warehouseId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/adjustments?${q.toString()}`);
  },

  async createAdjustment(
    data: Record<string, unknown>,
  ): Promise<StockAdjustment> {
    return api.post('/inventory/adjustments', data);
  },

  async submitAdjustment(id: string): Promise<StockAdjustment> {
    return api.post(`/inventory/adjustments/${id}/submit`, {});
  },

  async approveAdjustment(id: string): Promise<StockAdjustment> {
    return api.post(`/inventory/adjustments/${id}/approve`, {});
  },

  async postAdjustment(id: string): Promise<StockAdjustment> {
    return api.post(`/inventory/adjustments/${id}/post`, {});
  },
};
