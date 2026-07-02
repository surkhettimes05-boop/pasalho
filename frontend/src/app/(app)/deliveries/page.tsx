'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { deliveriesApi, Delivery } from '@/lib/api/deliveries';
import { formatDate, formatDateTime } from '@/lib/utils/cn';

const STATUS_FILTERS = ['ALL', 'PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED'];

export default function DeliveriesPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => deliveriesApi.list({ limit: 100 }),
  });

  const items: Delivery[] = (data?.items ?? []).filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.deliveryNo.toLowerCase().includes(q) ||
      d.driverName?.toLowerCase().includes(q) ||
      d.vehicleRef?.toLowerCase().includes(q) ||
      d.route?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deliveries</h1>
          <p className="mt-1 text-sm text-slate-500">Track vehicle dispatches and retailer deliveries</p>
        </div>
        <Link href="/deliveries/new">
          <Button>+ New Delivery</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search deliveries..."
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
          No deliveries found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Delivery #</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.deliveryNo}</td>
                  <td className="px-4 py-3 text-gray-500">{d.route?.name ?? '—'}</td>
                  <td className="px-4 py-3">{d.driverName ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.vehicleRef ?? '—'}</td>
                  <td className="px-4 py-3">{d._count?.items ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500">{d.scheduledAt ? formatDate(d.scheduledAt) : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusVariant(d.status)}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/deliveries/${d.id}`} className="text-blue-600 hover:underline">View</Link>
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
