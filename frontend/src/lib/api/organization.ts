import { api, PaginatedResponse } from './client';

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  district: string;
  region?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Warehouse {
  id: string;
  branchId: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  branch?: { id: string; name: string };
  inventoryLocation?: { id: string; code: string; name: string };
}

export const organizationApi = {
  async listBranches(): Promise<PaginatedResponse<Branch>> {
    return api.get('/branches');
  },
  async listWarehouses(branchId?: string): Promise<PaginatedResponse<Warehouse>> {
    return api.get(`/warehouses${branchId ? `?branchId=${branchId}` : ''}`);
  },
};
