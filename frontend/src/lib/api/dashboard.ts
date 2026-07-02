import { api } from './client';

export interface TodaySummary {
  invoiceCount: number;
  invoiceSalesTotal: number;
  paymentCount: number;
  paymentsTotal: number;
}

export interface OutstandingSummary {
  totalRetailerCredit: number;
}

export interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  status: string;
  createdAt: string;
  retailer: { shopName: string };
}

export interface RecentMovement {
  id: string;
  movementType: string;
  quantity: number;
  occurredAt: string;
  product: { name: string };
  location: { name: string };
}

export interface DashboardSummary {
  today: TodaySummary;
  outstanding: OutstandingSummary;
  lowStockCount: number;
  recentInvoices: RecentInvoice[];
  recentMovements: RecentMovement[];
}

export const dashboardApi = {
  async get(branchId?: string): Promise<DashboardSummary> {
    const params = branchId ? `?branchId=${branchId}` : '';
    const res = (await api.get(`/dashboard/admin-summary${params}`)) as unknown as DashboardSummary;
    return res;
  },
};
