import { api, PaginatedResponse } from './client';

export interface RouteStop {
  id: string;
  routeId: string;
  retailerId: string;
  retailer: { id: string; shopName: string; ownerName: string; phone: string };
  stopOrder: number;
  notes?: string;
}

export interface Route {
  id: string;
  branchId: string;
  branch: { id: string; name: string };
  salesRepId: string;
  salesRep: { id: string; user: { id: string; fullName: string } };
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  stops: RouteStop[];
  createdAt: string;
  updatedAt: string;
  _count?: { stops: number; orders: number };
}

export const routesApi = {
  async list(params?: {
    branchId?: string;
    salesRepId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<Route>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.salesRepId) q.set('salesRepId', params.salesRepId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    return api.get(`/routes?${q}`);
  },

  async findById(id: string): Promise<Route> {
    return api.get(`/routes/${id}`);
  },

  async create(data: {
    branchId: string;
    salesRepId: string;
    code: string;
    name: string;
    description?: string;
    stops?: { retailerId: string; stopOrder: number; notes?: string }[];
  }): Promise<Route> {
    return api.post('/routes', data);
  },

  async update(id: string, data: Record<string, unknown>): Promise<Route> {
    return api.patch(`/routes/${id}`, data);
  },

  async deactivate(id: string): Promise<Route> {
    return api.delete(`/routes/${id}`);
  },
};
