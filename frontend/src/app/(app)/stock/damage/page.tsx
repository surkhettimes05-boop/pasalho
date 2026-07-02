'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { damageApi, DamageReport } from '@/lib/api/phase4';
import { formatDate } from '@/lib/utils/cn';

const STATUS_FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED'];

export default function DamageReportsPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['damage-reports', statusFilter],
    queryFn: () => damageApi.list({ status: statusFilter === 'ALL' ? undefined : statusFilter, limit: 100 }),
  });

  const items: DamageReport[] = (data?.items ?? []).filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.reportNo.toLowerCase().includes(q) ||
      d.reason.toLowerCase().includes(q) ||
      d.warehouse?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Damage Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Record and approve damaged stock write-offs</p>
        </div>
        <Link href="/stock/damage/new">
          <Button>+ New Damage Report</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search reports..." className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
        </select>
      </div>

      {isLoading ? <Spinner /> : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No damage reports found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Report #</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium font-mono text-xs">{d.reportNo}</td>
                  <td className="px-4 py-3">{d.warehouse?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.reason}</td>
                  <td className="px-4 py-3">{d._count?.items ?? d.items?.length ?? 0}</td>
                  <td className="px-4 py-3"><Badge className={statusVariant(d.status)}>{d.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/stock/damage/${d.id}`} className="text-blue-600 hover:underline">View</Link>
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
