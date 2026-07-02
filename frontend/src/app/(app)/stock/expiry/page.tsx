'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { expiryApi, ExpiryEvent } from '@/lib/api/phase4';
import { formatDate, cn } from '@/lib/utils/cn';

type DaysFilter = 'ALL' | '7' | '30' | '60' | 'EXPIRED';

function urgencyClass(days: number) {
  if (days <= 0) return 'bg-red-100 text-red-700 border-red-200';
  if (days <= 7) return 'bg-red-50 text-red-600 border-red-100';
  if (days <= 30) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-yellow-50 text-yellow-700 border-yellow-100';
}

export default function ExpiryDashboardPage() {
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('ALL');
  const [showActedUpon, setShowActedUpon] = useState(false);
  const queryClient = useQueryClient();

  const summaryQ = useQuery({
    queryKey: ['expiry-summary'],
    queryFn: () => expiryApi.getSummary(),
  });
  const summary = summaryQ.data;

  const eventsQ = useQuery({
    queryKey: ['expiry-events', daysFilter, showActedUpon],
    queryFn: () => expiryApi.listEvents({
      daysAhead: daysFilter === 'ALL' || daysFilter === 'EXPIRED' ? undefined : Number(daysFilter),
      isActedUpon: showActedUpon ? undefined : false,
      limit: 200,
    }),
  });

  const events: ExpiryEvent[] = (eventsQ.data?.items ?? []).filter((e) => {
    if (daysFilter === 'EXPIRED') return e.daysToExpiry <= 0;
    return true;
  });

  const scanMutation = useMutation({
    mutationFn: () => expiryApi.scan(60),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expiry-events'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-summary'] });
      alert(`Scan complete: ${data.detected} new events detected, ${data.autoBlocked} batches auto-blocked.`);
    },
  });

  const actMutation = useMutation({
    mutationFn: (id: string) => expiryApi.markActedUpon(id, 'Actioned via dashboard'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expiry-events'] }),
  });

  const blockMutation = useMutation({
    mutationFn: (batchId: string) => expiryApi.blockBatch(batchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expiry-events'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expiry Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor batches approaching expiry and take action</p>
        </div>
        <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
          {scanMutation.isPending ? 'Scanning...' : 'Scan Expiring Batches'}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Expired</p>
            <p className="mt-1 text-3xl font-bold text-red-700">{summary.expired}</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Within 7 days</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{summary.within7}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Within 30 days</p>
            <p className="mt-1 text-3xl font-bold text-amber-700">{summary.within30}</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600">Within 60 days</p>
            <p className="mt-1 text-3xl font-bold text-yellow-700">{summary.within60}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {(['ALL', 'EXPIRED', '7', '30', '60'] as DaysFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDaysFilter(f)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              daysFilter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {f === 'ALL' ? 'All' : f === 'EXPIRED' ? 'Expired' : `≤ ${f} days`}
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-2">
          <input type="checkbox" checked={showActedUpon} onChange={(e) => setShowActedUpon(e.target.checked)} />
          Show actioned
        </label>
      </div>

      {/* Events Table */}
      {eventsQ.isLoading ? <Spinner /> : events.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No expiry events found. Click "Scan Expiring Batches" to detect upcoming expirations.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Days Left</th>
                <th className="px-4 py-3">Batch Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => (
                <tr key={e.id} className={cn('hover:bg-gray-50', e.isActedUpon ? 'opacity-50' : '')}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.product?.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{e.product?.skuCode}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.batch?.batchNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{e.location?.name}</td>
                  <td className="px-4 py-3">{formatDate(e.expiryDate)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', urgencyClass(e.daysToExpiry))}>
                      {e.daysToExpiry <= 0 ? 'EXPIRED' : `${e.daysToExpiry}d`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusVariant(e.batch?.status ?? '')}>{e.batch?.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {!e.isActedUpon && (
                        <>
                          {e.batch?.status === 'ACTIVE' && (
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => { if (confirm('Block this batch?')) blockMutation.mutate(e.batchId); }}
                              disabled={blockMutation.isPending}
                            >
                              Block
                            </button>
                          )}
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => actMutation.mutate(e.id)}
                            disabled={actMutation.isPending}
                          >
                            Mark Actioned
                          </button>
                        </>
                      )}
                      {e.isActedUpon && (
                        <span className="text-xs text-gray-400">✓ {e.actionNote}</span>
                      )}
                    </div>
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
