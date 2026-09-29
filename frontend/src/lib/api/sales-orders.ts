import { api, PaginatedResponse } from './client';

export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'INVOICED' | 'PLACED' | 'CANCELLED' | 'PICKING' | 'PACKED' | 'DISPATCHED' | 'DELIVERED';

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
  branchId: string | null;
  branch?: { id: string; name: string } | null;
  salesRepId: string | null;
  salesRep?: { id: string; user: { id: string; fullName: string } } | null;
  routeId?: string;
  route?: { id: string; name: string; code: string };
  retailerId: string | null;
  retailer?: { id: string; shopName: string; ownerName: string; phone: string } | null;
  status: SalesOrderStatus;
  source?: string;
  notes?: string;
  subtotal: number | string;
  grandTotal: number | string;
  invoiceId?: string;
  invoice?: { id: string; invoiceNumber: string; status: string; paymentStatus?: string; paidAmount?: number | string; grandTotal: number | string };
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
    source?: string;
    retailerOrder?: boolean;
  }): Promise<PaginatedResponse<SalesOrder>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.salesRepId) q.set('salesRepId', params.salesRepId);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.source) q.set('source', params.source);
    if (params?.retailerOrder !== undefined) q.set('retailerOrder', String(params.retailerOrder));
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

  async updateStatus(id: string, status: Extract<SalesOrderStatus, 'PICKING' | 'PACKED' | 'DISPATCHED' | 'DELIVERED'>): Promise<SalesOrder> {
    return api.post(`/sales-orders/${id}/status`, { status });
  },

  async convertToInvoice(id: string, data: { warehouseId: string; sourceLocationId: string }): Promise<SalesOrder> {
    return api.post(`/sales-orders/${id}/convert-to-invoice`, data);
  },
};
