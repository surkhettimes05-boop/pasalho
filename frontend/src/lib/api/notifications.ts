import { api, PaginatedResponse } from './client';

export type NotificationType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ORDER_CONFIRMED' | 'DELIVERY_UPDATE' | 'SYSTEM';
export type NotificationStatus = 'UNREAD' | 'READ' | 'DISMISSED';

export interface Notification {
  id: string;
  branchId?: string;
  userId?: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
}

export const notificationsApi = {
  async list(params?: {
    status?: NotificationStatus;
    page?: number;
    limit?: number;
  }): Promise<NotificationListResponse> {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/notifications?${q}`);
  },

  async markRead(id: string): Promise<Notification> {
    return api.post(`/notifications/${id}/read`, {});
  },

  async markAllRead(): Promise<{ success: boolean }> {
    return api.post('/notifications/mark-all-read', {});
  },

  async generateLowStockAlerts(): Promise<{ created: number }> {
    return api.post('/notifications/generate-low-stock-alerts', {});
  },
};
