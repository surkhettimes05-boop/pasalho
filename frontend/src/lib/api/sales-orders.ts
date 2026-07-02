import { api, PaginatedResponse } from './client';

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'INVOICED' | 'CANCELLED';

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  product: { id: string; name: string; skuCode: string };
  batchId?: string;
  batch?: { id: string; batchNumber: string };
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number | string;
  baseQuantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  notes?: string;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  branchId: string;
  branch: { id: string; name: string };
  salesRepId: string;
  salesRep: { id: string; user: { id: string; fullName: string } };
  routeId?: string;
  route?: { id: string; name: string; code: string };
  retailerId: string;
  retailer: { id: string; shopName: string; ownerName: string; phone: string };
  status: SalesOrderStatus;
  notes?: string;
  subtotal: number | string;
  grandTotal: number | string;
  invoiceId?: string;
  invoice?: { id: string; invoiceNumber: string; status: string; grandTotal: number | string };
  createdBy: { id: string; fullName: string };
  confirmedAt?: string;
  createdAt: string;
  items: SalesOrderItem[];
  _count?: { items: number };
}

export const salesOrdersApi = {
  async list(params?: {
    branchId?: string;
    salesRepId?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<SalesOrder>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.salesRepId) q.set('salesRepId', params.salesRepId);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return api.get(`/sales-orders?${q}`);
  },

  async findById(id: string): Promise<SalesOrder> {
    return api.get(`/sales-orders/${id}`);
  },

  async create(data: Record<string, unknown>): Promise<SalesOrder> {
    return api.post('/sales-orders', data);
  },

  async confirm(id: string): Promise<SalesOrder> {
    return api.post(`/sales-orders/${id}/confirm`, {});
  },

  async cancel(id: string): Promise<SalesOrder> {
    return api.post(`/sales-orders/${id}/cancel`, {});
  },

  async convertToInvoice(id: string, data: { warehouseId: string; sourceLocationId: string }): Promise<SalesOrder> {
    return api.post(`/sales-orders/${id}/convert-to-invoice`, data);
  },
};
