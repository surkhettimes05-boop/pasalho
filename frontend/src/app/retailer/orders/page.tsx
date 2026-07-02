'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { formatDate, formatCurrency } from '@/lib/utils/cn';
import { retailerOrderApi, RetailerOrder } from '@/lib/api/retailer-portal';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function RetailerOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['retailer-orders', statusFilter],
    queryFn: () => retailerOrderApi.list({ status: statusFilter || undefined, limit: 100 }),
  });

  const items: RetailerOrder[] = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
          <p className="mt-0.5 text-sm text-gray-500">Order history and tracking</p>
        </div>
        <Link href="/retailer/orders/new">
          <Button size="sm">
            <PlusCircle className="mr-1 h-4 w-4" />
            New Order
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-44"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No orders found.{' '}
          <Link href="/retailer/orders/new" className="text-blue-600 hover:underline">
            Place your first order
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order) => (
            <Link key={order.id} href={`/retailer/orders/${order.id}`}>
              <div className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{order.orderNo}</p>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(order.grandTotal))}
                    </span>
                    <Badge className={statusVariant(order.status)}>{order.status}</Badge>
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <p className="mt-1 truncate text-xs text-gray-400">
                    {order.items.map((i) => i.product?.name).join(', ')}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
