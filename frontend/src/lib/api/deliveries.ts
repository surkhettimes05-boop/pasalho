import { api, PaginatedResponse } from './client';

export type DeliveryStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export interface DeliveryItem {
  id: string;
  deliveryId: string;
  retailerId: string;
  retailer: { id: string; shopName: string; ownerName: string; phone: string; address?: string };
  invoiceId?: string;
  invoice?: { id: string; invoiceNumber: string; grandTotal: number | string; status: string };
  orderId?: string;
  notes?: string;
  isDelivered: boolean;
}

export interface Delivery {
  id: string;
  deliveryNo: string;
  branchId: string;
  branch: { id: string; name: string };
  routeId?: string;
  route?: { id: string; name: string; code: string };
  vehicleRef?: string;
  driverName?: string;
  status: DeliveryStatus;
  scheduledAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
  notes?: string;
  createdBy: { id: string; fullName: string };
  items: DeliveryItem[];
  createdAt: string;
  _count?: { items: number };
}

export const deliveriesApi = {
  async list(params?: {
    branchId?: string;
    status?: string;
    routeId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Delivery>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.status) q.set('status', params.status);
    if (params?.routeId) q.set('routeId', params.routeId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return api.get(`/deliveries?${q}`);
  },

  async findById(id: string): Promise<Delivery> {
    return api.get(`/deliveries/${id}`);
  },

  async create(data: Record<string, unknown>): Promise<Delivery> {
    return api.post('/deliveries', data);
  },

  async update(id: string, data: Record<string, unknown>): Promise<Delivery> {
    return api.patch(`/deliveries/${id}`, data);
  },

  async dispatch(id: string): Promise<Delivery> {
    return api.post(`/deliveries/${id}/dispatch`, {});
  },

  async complete(id: string): Promise<Delivery> {
    return api.post(`/deliveries/${id}/complete`, {});
  },

  async cancel(id: string): Promise<Delivery> {
    return api.post(`/deliveries/${id}/cancel`, {});
  },

  async markItemDelivered(deliveryId: string, itemId: string, notes?: string): Promise<Delivery> {
    return api.post(`/deliveries/${deliveryId}/items/${itemId}/delivered`, { notes });
  },
};
