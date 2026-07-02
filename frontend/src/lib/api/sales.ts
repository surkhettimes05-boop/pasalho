import { api, PaginatedResponse } from './client';

export interface Retailer {
  id: string;
  branchId: string;
  code: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address?: string;
  creditLimit?: number | string;
  status: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
  updatedAt: string; // ISO timestamp from backend
}

export interface InvoiceItemInput {
  productId: string;
  batchId?: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
}

export interface CreateInvoiceDto {
  branchId: string;
  warehouseId: string;
  sourceLocationId: string;
  retailerId?: string;
  items: InvoiceItemInput[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  branchId: string;
  retailerId?: string;
  retailer?: Retailer;
  warehouseId: string;
  sourceLocationId: string;
  subtotal: number | string;
  discountTotal: number | string;
  taxTotal: number | string;
  grandTotal: number | string;
  dueAmount?: number | string;
  paidAmount?: number | string;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'CREDIT_OPEN' | 'VOIDED' | 'CANCELLED';
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  items?: any[];
  payments?: any[];
  createdBy?: { id: string; fullName: string };
  createdAt: string;
  postedAt?: string;
}

export const salesApi = {
  async listRetailers(params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<Retailer>> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit ?? 200));
    if (params?.search) q.set('search', params.search);
    return api.get(`/retailers?${q.toString()}`);
  },
  async listInvoices(params?: { branchId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Invoice>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/invoices?${q.toString()}`);
  },
  async getInvoice(id: string): Promise<Invoice> {
    return api.get(`/invoices/${id}`);
  },
  async createInvoice(data: CreateInvoiceDto): Promise<Invoice> {
    return api.post('/invoices', data);
  },
  async postInvoice(id: string): Promise<Invoice> {
    return api.post(`/invoices/${id}/post`);
  },
  async voidInvoice(id: string, reason: string): Promise<Invoice> {
    return api.post(`/invoices/${id}/void`, { reason });
  },
};
