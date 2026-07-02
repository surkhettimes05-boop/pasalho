'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { stockCountApi, StockCountItem } from '@/lib/api/phase4';
import { formatDate, formatNumber, cn } from '@/lib/utils/cn';

export default function StockCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: count, isLoading } = useQuery({
    queryKey: ['stock-count', id],
    queryFn: () => stockCountApi.findById(id),
  });

  // Local edit state — keyed by item id
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-count', id] });
    queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(edits).map(([itemId, countedQuantity]) => {
        const item = count!.items.find((i) => i.id === itemId)!;
        return { productId: item.productId, batchId: item.batchId ?? undefined, unitId: item.unitId, countedQuantity };
      });
      return stockCountApi.updateCount(id, items);
    },
    onSuccess: () => { invalidate(); setEdits({}); },
  });

  const submitMutation = useMutation({
    mutationFn: () => stockCountApi.submit(id),
    onSuccess: invalidate,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => stockCountApi.reconcile(id),
    onSuccess: invalidate,
  });

  if (isLoading) return <Spinner />;
  if (!count) return <div className="py-12 text-center text-gray-500">Count not found.</div>;

  const filteredItems = (count.items ?? []).filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.product?.name?.toLowerCase().includes(q) || item.product?.skuCode?.toLowerCase().includes(q);
  });

  const withVariance = count.items.filter((i) => Number(i.variance) !== 0).length;
  const totalItems = count.items.length;
  const hasUnsaved = Object.keys(edits).length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Stock Count</h1>
            <Badge className={statusVariant(count.status)}>{count.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {count.location?.name ?? '—'} · Started {formatDate(count.startedAt)} by {count.countedBy?.fullName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/stock/counts')}>Back</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total SKUs</p>
          <p className="mt-1 text-2xl font-bold">{totalItems}</p>
        </div>
        <div className={cn('rounded-lg border p-4', withVariance > 0 ? 'border-amber-300 bg-amber-50' : '')}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">With Variance</p>
          <p className={cn('mt-1 text-2xl font-bold', withVariance > 0 ? 'text-amber-600' : '')}>{withVariance}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Reconciled</p>
          <p className="mt-1 text-sm font-semibold">{count.reconciledAt ? formatDate(count.reconciledAt) : '—'}</p>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search product..."
        className="w-72"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">System Qty</th>
              <th className="px-4 py-3 text-right">Counted Qty</th>
              <th className="px-4 py-3 text-right">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.map((item) => {
              const editedValue = edits[item.id];
              const displayCount = editedValue !== undefined ? editedValue : Number(item.countedQuantity);
              const variance = displayCount - Number(item.systemQuantity);
              const hasVariance = variance !== 0;
              return (
                <tr key={item.id} className={cn('hover:bg-gray-50', hasVariance ? 'bg-amber-50' : '')}>
                  <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{item.batch?.batchNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit?.symbol}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.systemQuantity)}</td>
                  <td className="px-4 py-3 text-right">
                    {count.status === 'DRAFT' ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        className="w-24 text-right"
                        value={displayCount || ''}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                      />
                    ) : (
                      <span className="tabular-nums">{formatNumber(item.countedQuantity)}</span>
                    )}
                  </td>
                  <td className={cn('px-4 py-3 text-right tabular-nums font-semibold', hasVariance ? (variance > 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400')}>
                    {hasVariance ? `${variance > 0 ? '+' : ''}${formatNumber(variance)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {count.status === 'DRAFT' && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">Enter counted quantities above, then save. Submit when all counts are entered.</p>
          <div className="flex gap-3">
            {hasUnsaved && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Counts'}
              </Button>
            )}
            <Button
              variant={hasUnsaved ? 'outline' : 'primary' as any}
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || hasUnsaved}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit for Reconciliation'}
            </Button>
          </div>
          {hasUnsaved && <p className="text-xs text-amber-600">Save unsaved counts before submitting.</p>}
        </div>
      )}

      {count.status === 'SUBMITTED' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-800">
            Count submitted. Reconciliation will generate stock adjustments for all {withVariance} variance item(s) and post them automatically.
          </p>
          <Button onClick={() => reconcileMutation.mutate()} disabled={reconcileMutation.isPending}>
            {reconcileMutation.isPending ? 'Reconciling...' : `Reconcile (${withVariance} variances)`}
          </Button>
        </div>
      )}

      {count.status === 'RECONCILED' && (
        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
          Reconciled on {formatDate(count.reconciledAt!)}. All variances have been posted as stock adjustments.
        </div>
      )}
    </div>
  );
}
