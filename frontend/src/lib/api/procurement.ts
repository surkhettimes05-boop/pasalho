import { api, PaginatedResponse } from './client';

export interface Supplier {
  id: string; supplierCode: string; name: string; contactPerson?: string | null;
  phone?: string | null; email?: string | null; address?: string | null;
  taxIdentifier?: string | null; status: 'ACTIVE' | 'INACTIVE';
}
export interface PurchaseOrderItem {
  id: string; productId: string; productUnitId: string; orderedQuantity: string | number;
  receivedQuantity: string | number; unitCost: string | number; lineTotal: string | number;
  product: { id: string; name: string; skuCode: string; isBatchTracked: boolean; isExpiryTracked: boolean };
  productUnit: { id: string; unit: { name: string; symbol: string } };
}
export interface PurchaseOrder {
  id: string; purchaseOrderNumber: string; supplierId: string; warehouseId: string;
  status: string; subtotal: string | number; items: PurchaseOrderItem[];
  supplier: Supplier; warehouse: { name: string };
  goodsReceipts?: Array<{ id: string; receiptNumber: string; receivedAt: string; items: Array<{ id: string; productId: string; receivedQuantity: string | number; acceptedQuantity: string | number }> }>;
}

export const procurementApi = {
  async listSuppliers(page = 1): Promise<PaginatedResponse<Supplier>> { return api.get(`/suppliers?page=${page}&limit=100`); },
  async createSupplier(data: Partial<Supplier>): Promise<Supplier> { return api.post('/suppliers', data); },
  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> { return api.patch(`/suppliers/${id}`, data); },
  async deactivateSupplier(id: string): Promise<Supplier> { return api.delete(`/suppliers/${id}`); },
  async listPurchaseOrders(warehouseId: string): Promise<PaginatedResponse<PurchaseOrder>> { return api.get(`/purchase-orders?warehouseId=${encodeURIComponent(warehouseId)}&limit=100`); },
  async getPurchaseOrder(id: string): Promise<PurchaseOrder> { return api.get(`/purchase-orders/${id}`); },
  async createPurchaseOrder(data: unknown): Promise<PurchaseOrder> { return api.post('/purchase-orders', data); },
  async confirmPurchaseOrder(id: string): Promise<PurchaseOrder> { return api.post(`/purchase-orders/${id}/confirm`, {}); },
  async receive(id: string, items: unknown[], key: string): Promise<unknown> { return api.post(`/purchase-orders/${id}/receipts`, { items }, { headers: { 'Idempotency-Key': key } }); },
};
