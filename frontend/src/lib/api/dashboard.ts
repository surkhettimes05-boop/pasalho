import { api } from './client';

export interface DashboardSummary {
  todaySales?: number | string;
  pendingInvoices?: number;
  lowStockItems?: number;
  activeRetailers?: number;
}

export const dashboardApi = {
  async get(): Promise<DashboardSummary> {
    try {
      return await api.get('/dashboard');
    } catch {
      // Return placeholder when endpoint missing or not yet implemented
      return {};
    }
  },
};
