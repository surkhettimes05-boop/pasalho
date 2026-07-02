'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { stockCountApi, StockCount } from '@/lib/api/phase4';
import { formatDate, formatDateTime } from '@/lib/utils/cn';

export default function StockCountsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-counts'],
    queryFn: () => stockCountApi.list({ limit: 100 }),
  });

  const items: StockCount[] = (data?.items ?? []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.location?.name?.toLowerCase().includes(q) ||
      c.countedBy?.fullName?.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Counts</h1>
          <p className="mt-1 text-sm text-slate-500">Physical count sessions and reconciliation</p>
        </div>
        <Link href="/stock/counts/new">
          <Button>+ Start Count</Button>
        </Link>
      </div>

      <Input
        placeholder="Search by location or counter..."
        className="w-64"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No stock counts yet. Start a count to compare physical stock against the ledger.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Counted By</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Reconciled</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.location?.name ?? '—'}</td>
                  <td className="px-4 py-3">{c.countedBy?.fullName ?? '—'}</td>
                  <td className="px-4 py-3">{c.items?.length ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusVariant(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(c.startedAt)}</td>
                  <td className="px-4 py-3 text-gray-500">{c.reconciledAt ? formatDate(c.reconciledAt) : '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/stock/counts/${c.id}`} className="text-blue-600 hover:underline">
                      {c.status === 'DRAFT' ? 'Enter Counts' : 'View'}
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
