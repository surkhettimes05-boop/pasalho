import { api, PaginatedResponse } from './client';

// ─── Stock Count / Reconciliation ─────────────────────────────────────────────

export type StockCountStatus = 'DRAFT' | 'SUBMITTED' | 'RECONCILED' | 'CANCELLED';

export interface StockCountItem {
  id: string;
  stockCountId: string;
  productId: string;
  product: { id: string; name: string; skuCode: string };
  batchId?: string;
  batch?: { id: string; batchNumber: string; expiryDate?: string };
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  systemQuantity: number | string;
  countedQuantity: number | string;
  variance: number | string;
  isReconciled: boolean;
}

export interface StockCount {
  id: string;
  branchId: string;
  warehouseId: string;
  locationId: string;
  status: StockCountStatus;
  countedById: string;
  countedBy: { id: string; fullName: string };
  startedAt: string;
  completedAt?: string;
  reconciledAt?: string;
  items: StockCountItem[];
  location?: { id: string; name: string };
}

export const stockCountApi = {
  async list(params?: { branchId?: string; locationId?: string; page?: number; limit?: number }): Promise<PaginatedResponse<StockCount>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.locationId) q.set('locationId', params.locationId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/reconciliation/sessions?${q}`);
  },

  async findById(id: string): Promise<StockCount> {
    return api.get(`/inventory/reconciliation/sessions/${id}`);
  },

  async start(data: { branchId: string; warehouseId: string; locationId: string }): Promise<StockCount> {
    return api.post('/inventory/reconciliation/start', data);
  },

  async updateCount(id: string, items: { productId: string; batchId?: string; unitId: string; countedQuantity: number }[]): Promise<StockCount> {
    return api.post(`/inventory/reconciliation/sessions/${id}/update`, items);
  },

  async submit(id: string): Promise<StockCount> {
    return api.post(`/inventory/reconciliation/sessions/${id}/submit`, {});
  },

  async reconcile(id: string): Promise<StockCount> {
    return api.post(`/inventory/reconciliation/sessions/${id}/reconcile`, {});
  },
};

// ─── Damage Reports ───────────────────────────────────────────────────────────

export type DamageReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REJECTED';
export type DamageType = 'PHYSICAL' | 'EXPIRED' | 'WATER' | 'PEST' | 'OTHER';

export interface DamageReportItem {
  id: string;
  productId: string;
  product: { id: string; name: string; skuCode: string };
  batchId?: string;
  batch?: { id: string; batchNumber: string; expiryDate?: string };
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number | string;
  baseQuantity: number | string;
  damageType: DamageType;
  notes?: string;
}

export interface DamageReport {
  id: string;
  reportNo: string;
  branchId: string;
  branch: { id: string; name: string };
  warehouseId: string;
  warehouse: { id: string; name: string; code: string };
  locationId: string;
  location?: { id: string; name: string };
  status: DamageReportStatus;
  reason: string;
  notes?: string;
  createdBy: { id: string; fullName: string };
  approvedBy?: { id: string; fullName: string };
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
  postedAt?: string;
  createdAt: string;
  items: DamageReportItem[];
  _count?: { items: number };
}

export const damageApi = {
  async list(params?: { branchId?: string; status?: string; page?: number; limit?: number }): Promise<PaginatedResponse<DamageReport>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/damage-reports?${q}`);
  },

  async findById(id: string): Promise<DamageReport> {
    return api.get(`/inventory/damage-reports/${id}`);
  },

  async create(data: Record<string, unknown>): Promise<DamageReport> {
    return api.post('/inventory/damage-reports', data);
  },

  async submit(id: string): Promise<DamageReport> {
    return api.post(`/inventory/damage-reports/${id}/submit`, {});
  },

  async approve(id: string): Promise<DamageReport> {
    return api.post(`/inventory/damage-reports/${id}/approve`, {});
  },

  async reject(id: string, reason: string): Promise<DamageReport> {
    return api.post(`/inventory/damage-reports/${id}/reject`, { reason });
  },

  async post(id: string): Promise<DamageReport> {
    return api.post(`/inventory/damage-reports/${id}/post`, {});
  },
};

// ─── Expiry ───────────────────────────────────────────────────────────────────

export interface ExpiryEvent {
  id: string;
  branchId: string;
  branch: { id: string; name: string };
  batchId: string;
  batch: { id: string; batchNumber: string; expiryDate: string; status: string };
  productId: string;
  product: { id: string; name: string; skuCode: string };
  locationId: string;
  location: { id: string; name: string };
  expiryDate: string;
  daysToExpiry: number;
  detectedAt: string;
  isActedUpon: boolean;
  actionNote?: string;
}

export interface ExpirySummary {
  expired: number;
  within7: number;
  within30: number;
  within60: number;
}

export const expiryApi = {
  async listEvents(params?: {
    branchId?: string;
    daysAhead?: number;
    isActedUpon?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ExpiryEvent>> {
    const q = new URLSearchParams();
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.daysAhead !== undefined) q.set('daysAhead', String(params.daysAhead));
    if (params?.isActedUpon !== undefined) q.set('isActedUpon', String(params.isActedUpon));
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return api.get(`/inventory/expiry/events?${q}`);
  },

  async getSummary(branchId?: string): Promise<ExpirySummary> {
    return api.get(`/inventory/expiry/summary${branchId ? `?branchId=${branchId}` : ''}`);
  },

  async scan(daysAhead = 60): Promise<{ detected: number; autoBlocked: number }> {
    return api.post(`/inventory/expiry/scan?daysAhead=${daysAhead}`, {});
  },

  async markActedUpon(id: string, actionNote?: string): Promise<ExpiryEvent> {
    return api.post(`/inventory/expiry/events/${id}/acted-upon`, { actionNote });
  },

  async blockBatch(batchId: string): Promise<unknown> {
    return api.post(`/inventory/expiry/batches/${batchId}/block`, {});
  },
};
