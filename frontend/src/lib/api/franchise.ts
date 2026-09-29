import { api } from './client';

export type FranchiseStatus = 'REQUESTED' | 'APPROVED' | 'PICKING' | 'PACKED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
export type FranchisePartner = { id: string; name: string; phone: string; email?: string; status: string };
export type FranchiseStore = { id: string; partnerId: string; name: string; address: string; status: string; partnerName?: string; partnerPhone?: string };
export type FranchiseSupplyOrder = {
  id: string; orderNumber: string; storeId: string; salesOrderId?: string | null; status: FranchiseStatus;
  totalAmount?: number | string | null; createdAt: string; storeName: string; storeAddress: string;
  partnerName: string; supplyReference?: string | null;
  items: Array<{ id: string; productId: string; sku: string; productName: string; quantity: number | string; unit: string; unitPrice?: number | string | null; lineTotal?: number | string | null }>;
  history?: Array<{ fromStatus?: string | null; toStatus: string; actorId: string; notes?: string; createdAt: string }>;
};

export const franchiseApi = {
  overview: async () => (await api.get<Record<string, unknown>>('/franchise/overview')).data,
  listPartners: async () => (await api.get<FranchisePartner[]>('/franchise/partners')).data,
  createPartner: async (data: { name: string; phone: string; email?: string }) => (await api.post<FranchisePartner>('/franchise/partners', data)).data,
  listStores: async () => (await api.get<FranchiseStore[]>('/franchise/stores')).data,
  createStore: async (data: { partnerId: string; name: string; address: string }) => (await api.post<FranchiseStore>('/franchise/stores', data)).data,
  listOrders: async () => (await api.get<FranchiseSupplyOrder[]>('/franchise/supply-orders')).data,
  getOrder: async (id: string) => (await api.get<FranchiseSupplyOrder>(`/franchise/supply-orders/${id}`)).data,
  createOrder: async (data: { storeId: string; items: Array<{ productId: string; unitId?: string; quantity: number }> }) => (await api.post<FranchiseSupplyOrder>('/franchise/supply-orders', data)).data,
  transition: async (id: string, action: 'approve' | 'pick' | 'pack' | 'dispatch' | 'receive') => (await api.post<FranchiseSupplyOrder>(`/franchise/supply-orders/${id}/${action}`, {})).data,
};
