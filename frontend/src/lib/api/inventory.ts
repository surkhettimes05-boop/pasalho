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

export type StockTransferStatus = 'DRAFT' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';

export interface StockTransfer {
  id: string;
  transferNo: string;
  fromBranchId: string;
  fromBranch: { id: string; name: string };
  fromWarehouseId: string;
  fromWarehouse: { id: string; name: string; code: string };
  fromLocationId: string;
  fromLocation?: { id: string; name: string };
  toBranchId: string;
  toBranch: { id: string; name: string };
  toWarehouseId: string;
  toWarehouse: { id: string; name: string; code: string };
  toLocationId: string;
  toLocation?: { id: string; name: string };
  status: StockTransferStatus;
  notes?: string;
  createdBy: { id: string; fullName: string };
  shippedBy?: { id: string; fullName: string };
  receivedBy?: { id: string; fullName: string };
  shippedAt?: string;
  receivedAt?: string;
  items: StockTransferItem[];
  createdAt: string;
}

export interface StockTransferItem {
  id: string;
  productId: string;
  product: { id: string; name: string; skuCode: string };
  batchId?: string;
  batch?: { id: string; batchNumber: string };
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number | string;
  baseQuantity: number | string;
  receivedQuantity?: number | string;
  receivedBaseQuantity?: number | string;
  varianceQuantity?: number | string;
}

export const transferApi = {
  async list(params?: {
    branchId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<StockTransfer>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/transfers?${q.toString()}`);
  },

  async findById(id: string): Promise<StockTransfer> {
    return api.get(`/inventory/transfers/${id}`);
  },

  async create(
    data: Record<string, unknown>,
  ): Promise<StockTransfer> {
    return api.post('/inventory/transfers', data);
  },

  async ship(id: string): Promise<StockTransfer> {
    return api.post(`/inventory/transfers/${id}/ship`, {});
  },

  async receive(id: string): Promise<StockTransfer> {
    return api.post(`/inventory/transfers/${id}/receive`, {});
  },
};
