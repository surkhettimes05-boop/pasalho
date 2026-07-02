'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { formatDate, formatCurrency } from '@/lib/utils/cn';
import { retailerApi } from '@/lib/api/retailer-portal';
import { useRetailerAuth } from '../layout';

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
];

export default function RetailerInvoicesPage() {
  const { profile } = useRetailerAuth();
  const [paymentFilter, setPaymentFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['retailer-invoices', profile?.id],
    queryFn: () =>
      retailerApi.get('/invoices', {
        params: { retailerId: profile?.id, limit: 100 },
      }),
    enabled: !!profile?.id,
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.items ?? [];

  const filtered = paymentFilter
    ? items.filter((inv) => inv.paymentStatus === paymentFilter)
    : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">Your invoice history</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="w-44"
        >
          {PAYMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No invoices found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv: any) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}>
              <div className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(inv.grandTotal))}
                    </span>
                    <Badge className={statusVariant(inv.paymentStatus || inv.status)}>
                      {inv.paymentStatus || inv.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
