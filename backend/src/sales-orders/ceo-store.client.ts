import { createHash } from 'crypto';

export type StoreFulfillmentItem = { productId: string; quantity: number };

export type StoreFulfillmentRequest = {
  externalOrderId: string;
  pasaloOrderId: string;
  branchCode: string;
  customerName?: string;
  shippingAddress?: string;
  items: StoreFulfillmentItem[];
};

export class CeoStoreFulfillmentError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'CeoStoreFulfillmentError';
  }
}

export class CeoStoreClient {
  private readonly baseUrl = process.env.CEO_ONLINE_ORDER_URL?.replace(/\/$/, '');
  private readonly secret = process.env.STORE_SYNC_WEBHOOK_SECRET;

  isConfigured() {
    return Boolean(this.baseUrl && this.secret);
  }

  private async request(path: string, method: 'POST', body?: unknown) {
    if (!this.baseUrl || !this.secret) {
      throw new CeoStoreFulfillmentError('CEO store fulfillment integration is not configured.', 503);
    }
    const serialized = body === undefined ? '' : JSON.stringify(body);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-pasalo-webhook-secret': this.secret,
        'idempotency-key': `pasalo-online-${createHash('sha256').update(path + serialized).digest('hex')}`,
      },
      body: serialized || undefined,
      signal: AbortSignal.timeout(Number(process.env.CEO_ONLINE_ORDER_TIMEOUT_MS || 10_000)),
    }).catch((error) => {
      throw new CeoStoreFulfillmentError(error instanceof Error ? error.message : 'CEO store fulfillment request failed.', 503);
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new CeoStoreFulfillmentError(payload?.message || `CEO store fulfillment returned HTTP ${response.status}.`, response.status >= 500 ? 503 : response.status);
    }
    const data = payload?.data ?? payload;
    if (data?.status === 'COMPLETING') {
      throw new CeoStoreFulfillmentError('CEO store sale is already being completed; retry the fulfillment update.', 503);
    }
    return data;
  }

  reserve(request: StoreFulfillmentRequest) {
    return this.request('/online-fulfillments/reserve', 'POST', request);
  }

  complete(externalOrderId: string) {
    return this.request(`/online-fulfillments/${encodeURIComponent(externalOrderId)}/complete`, 'POST');
  }

  cancel(externalOrderId: string) {
    return this.request(`/online-fulfillments/${encodeURIComponent(externalOrderId)}/cancel`, 'POST');
  }
}
