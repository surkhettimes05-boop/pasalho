import axios from 'axios';
import { PaginatedResponse } from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const RETAILER_TOKEN_KEY = 'pasalo_retailer_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(RETAILER_TOKEN_KEY);
}

import { handleMockRequest } from './demo-mock-data';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

export const retailerApi = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  adapter: IS_DEMO ? (handleMockRequest as any) : undefined,
});

retailerApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

retailerApi.interceptors.response.use(
  (response) => {
    const body = response.data;
    return body.data ?? body;
  },
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(RETAILER_TOKEN_KEY);
      localStorage.removeItem('pasalo_retailer_profile');
      if (!window.location.pathname.startsWith('/retailer/login') && !window.location.pathname.startsWith('/retailer/set-pin')) {
        window.location.href = '/retailer/login';
      }
    }
    const message = error.response?.data?.error?.message || error.message || 'Network error';
    return Promise.reject(new Error(message));
  },
);

export interface RetailerProfile {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  branchId: string;
  creditLimit: number;
  outstanding: number;
  orderPreference?: string;
}

export interface RetailerOrderItem {
  id: string;
  productId: string;
  product: { id: string; name: string; skuCode: string };
  batchId?: string;
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface RetailerOrder {
  id: string;
  orderNo: string;
  branchId: string;
  retailerId: string;
  status: string;
  notes?: string;
  subtotal: number;
  grandTotal: number;
  createdAt: string;
  items: RetailerOrderItem[];
  invoiceId?: string;
}

export interface RetailerNotification {
  id: string;
  retailerId: string;
  type: string;
  status: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  readAt?: string;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  skuCode: string;
  orderCount: number;
  lastOrderedAt: string;
}

export interface RetailerProduct {
  id: string;
  skuCode: string;
  name: string;
  barcode?: string;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  defaultUnitId: string;
  defaultUnit?: { id: string; name: string; symbol: string };
  units?: Array<{ id: string; name: string; symbol: string }>;
  batches?: Array<{ id: string; batchNumber: string; expiryDate?: string; availableQuantity?: number }>;
}

export interface RetailerInvoice {
  id: string;
  invoiceNumber: string;
  branchId: string;
  retailerId?: string;
  retailer?: { id: string; shopName: string };
  subtotal: number | string;
  grandTotal: number | string;
  dueAmount?: number | string;
  paidAmount?: number | string;
  status: string;
  paymentStatus?: string;
  createdAt: string;
  postedAt?: string;
}

export interface RetailerPayment {
  id: string;
  paymentNumber: string;
  retailerId?: string;
  amount: number | string;
  method: string;
  reference?: string;
  notes?: string;
  status: string;
  createdAt: string;
}

export interface RetailerOrderInput {
  items: { productId: string; unitId: string; batchId?: string; quantity: number }[];
  notes?: string;
}

export interface RetailerLoginResponse {
  accessToken: string;
  retailer: RetailerProfile;
}

export const retailerAuthApi = {
  async login(phone: string, pin: string, deviceId?: string, deviceType?: string): Promise<RetailerLoginResponse> {
    return retailerApi.post('/retailer-portal/auth/login', { phone, pin, deviceId, deviceType });
  },
  async initPin(phone: string, pin: string, confirmPin: string): Promise<void> {
    return retailerApi.post('/retailer-portal/auth/init-pin', { phone, pin, confirmPin });
  },
  async setPin(pin: string, confirmPin: string): Promise<void> {
    return retailerApi.post('/retailer-portal/auth/set-pin', { pin, confirmPin });
  },
  async changePin(currentPin: string, newPin: string, confirmNewPin: string): Promise<void> {
    return retailerApi.post('/retailer-portal/auth/change-pin', { currentPin, newPin, confirmNewPin });
  },
  async logout(): Promise<void> {
    return retailerApi.post('/retailer-portal/auth/logout', {});
  },
  async getProfile(): Promise<RetailerProfile> {
    return retailerApi.get('/retailer-portal/auth/me');
  },
};

export const retailerOrderApi = {
  async list(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<RetailerOrder>> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return retailerApi.get(`/retailer-portal/orders?${q.toString()}`);
  },
  async findById(id: string): Promise<RetailerOrder> {
    return retailerApi.get(`/retailer-portal/orders/${id}`);
  },
  async create(data: RetailerOrderInput): Promise<RetailerOrder> {
    return retailerApi.post('/retailer-portal/orders', data);
  },
  async cancel(id: string): Promise<RetailerOrder> {
    return retailerApi.post(`/retailer-portal/orders/${id}/cancel`, {});
  },
};

export interface RetailerNotificationListResponse extends PaginatedResponse<RetailerNotification> {
  unreadCount?: number;
}

export const retailerNotificationApi = {
  async list(params?: { page?: number; limit?: number }): Promise<RetailerNotificationListResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return retailerApi.get(`/retailer-portal/notifications?${q.toString()}`);
  },
  async markRead(id: string): Promise<void> {
    return retailerApi.post(`/retailer-portal/notifications/${id}/read`, {});
  },
  async markAllRead(): Promise<void> {
    return retailerApi.post('/retailer-portal/notifications/mark-all-read', {});
  },
  async getUnreadCount(): Promise<{ count: number }> {
    return retailerApi.get('/retailer-portal/notifications/unread-count');
  },
};

export const retailerRecommendationApi = {
  async getQuickReorder(): Promise<ReorderSuggestion[]> {
    return retailerApi.get('/retailer-portal/recommendations/quick-reorder');
  },
  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    return retailerApi.get('/retailer-portal/recommendations/suggestions');
  },
};

export const retailerWhatsAppApi = {
  async incoming(data: Record<string, unknown>): Promise<void> {
    return retailerApi.post('/retailer-portal/whatsapp/incoming', data);
  },
};
