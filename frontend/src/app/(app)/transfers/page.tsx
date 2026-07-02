'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { transferApi, StockTransfer } from '@/lib/api/inventory';
import { formatDate } from '@/lib/utils/cn';

const STATUS_FILTERS = ['ALL', 'DRAFT', 'SHIPPED', 'RECEIVED', 'CANCELLED'];

export default function TransfersListPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['transfers'],
    queryFn: () => transferApi.list({ page: 1, limit: 100 }),
  });

  const items: StockTransfer[] = (listQ.data?.items ?? []).filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.transferNo?.toLowerCase().includes(q) ||
      t.fromBranch?.name?.toLowerCase().includes(q) ||
      t.toBranch?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Transfers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Warehouse-to-warehouse and branch-to-branch transfers
          </p>
        </div>
        <Link href="/transfers/new">
          <Button>+ New Transfer</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search transfers..."
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
            <option key={s} value={s}>
              {s === 'ALL' ? 'All Statuses' : s}
            </option>
          ))}
        </select>
      </div>

      {listQ.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No transfers found. Create a transfer to move stock between locations.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Transfer #</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.transferNo}</td>
                  <td className="px-4 py-3">{t.fromBranch?.name ?? '—'}</td>
                  <td className="px-4 py-3">{t.toBranch?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusVariant(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{t.items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/transfers/${t.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
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
