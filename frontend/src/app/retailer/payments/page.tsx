'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@/lib/utils/cn';
import { retailerApi } from '@/lib/api/retailer-portal';
import { useRetailerAuth } from '../auth-context';

export default function RetailerPaymentsPage() {
  const { profile } = useRetailerAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['retailer-payments', profile?.id],
    queryFn: () =>
      retailerApi.get('/payments', {
        params: { retailerId: profile?.id, limit: 100 },
      }),
    enabled: !!profile?.id,
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">Your payment history</p>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No payments found.</div>
      ) : (
        <div className="space-y-3">
          {items.map((payment: any) => (
            <div
              key={payment.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {payment.paymentNumber || 'Payment'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(payment.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(Number(payment.amount))}
                  </span>
                  <Badge variant="blue">{payment.method}</Badge>
                </div>
              </div>
              {payment.reference && (
                <p className="mt-1 text-xs text-gray-400">Ref: {payment.reference}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
