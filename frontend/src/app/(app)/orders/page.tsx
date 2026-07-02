'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { salesOrdersApi, SalesOrder } from '@/lib/api/sales-orders';
import { formatDate, formatCurrency } from '@/lib/utils/cn';

const STATUS_FILTERS = ['ALL', 'DRAFT', 'CONFIRMED', 'INVOICED', 'CANCELLED'];

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => salesOrdersApi.list({ limit: 100 }),
  });

  const items: SalesOrder[] = (data?.items ?? []).filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNo.toLowerCase().includes(q) ||
      o.retailer?.shopName?.toLowerCase().includes(q) ||
      o.salesRep?.user?.fullName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Orders</h1>
          <p className="mt-1 text-sm text-slate-500">Orders captured by sales reps on route</p>
        </div>
        <Link href="/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search orders..."
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No sales orders found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Retailer</th>
                <th className="px-4 py-3">Sales Rep</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{o.orderNo}</td>
                  <td className="px-4 py-3">{o.retailer?.shopName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.salesRep?.user?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.route?.name ?? '—'}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(o.grandTotal))}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusVariant(o.status)}>{o.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
