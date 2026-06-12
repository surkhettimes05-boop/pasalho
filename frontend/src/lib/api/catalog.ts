import { api, PaginatedResponse } from './client';

export interface Product {
  id: string;
  skuCode: string;
  name: string;
  barcode?: string;
  categoryId: string;
  category?: { id: string; name: string; code: string };
  defaultUnitId: string;
  defaultUnit?: { id: string; name: string; symbol: string };
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  isActive?: boolean;
  costPrice?: number | string;
  mrp?: number | string;
  status?: 'ACTIVE' | 'INACTIVE'; // derived display field
}

export interface Category {
  id: string;
  code: string;
  name: string;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export const catalogApi = {
  async listProducts(params?: { search?: string; categoryId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Product>> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/catalog/products?${q.toString()}`);
  },
  async getProduct(id: string): Promise<Product> {
    return api.get(`/catalog/products/${id}`);
  },
  async listCategories(): Promise<Category[]> {
    return api.get('/catalog/categories');
  },
  async listUnits(): Promise<Unit[]> {
    return api.get('/catalog/units');
  },
};
