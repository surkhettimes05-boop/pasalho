'use client';

import { use, useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { transferApi, StockTransfer } from '@/lib/api/inventory';
import { formatDate, formatCurrency } from '@/lib/utils/cn';

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: transfer, isLoading } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => transferApi.findById(id),
  });

  const shipMutation = useMutation({
    mutationFn: () => transferApi.ship(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: () => transferApi.receive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });

  if (isLoading) return <Spinner />;
  if (!transfer) return <div className="py-12 text-center text-gray-500">Transfer not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{transfer.transferNo}</h1>
            <Badge className={statusVariant(transfer.status)}>{transfer.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Created {formatDate(transfer.createdAt)} by {transfer.createdBy?.fullName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/transfers')}>
            Back to List
          </Button>
        </div>
      </div>

      {/* Route Info */}
      <div className="grid grid-cols-2 gap-6 rounded-lg border p-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Origin</h3>
          <p className="font-medium">{transfer.fromBranch?.name}</p>
          <p className="text-sm text-gray-500">{transfer.fromWarehouse?.name}</p>
          {transfer.shippedAt && (
            <p className="mt-2 text-xs text-gray-400">Shipped {formatDate(transfer.shippedAt)}</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Destination</h3>
          <p className="font-medium">{transfer.toBranch?.name}</p>
          <p className="text-sm text-gray-500">{transfer.toWarehouse?.name}</p>
          {transfer.receivedAt && (
            <p className="mt-2 text-xs text-gray-400">Received {formatDate(transfer.receivedAt)}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      {transfer.notes && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h3>
          <p className="text-sm">{transfer.notes}</p>
        </div>
      )}

      {/* Items Table */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Transfer Items</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Shipped Qty</th>
                <th className="px-4 py-3">Received Qty</th>
                <th className="px-4 py-3">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transfer.items.map((item) => {
                const shipped = Number(item.quantity);
                const received = item.receivedQuantity ? Number(item.receivedQuantity) : null;
                const variance = item.varianceQuantity ? Number(item.varianceQuantity) : null;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.product?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.batch?.batchNumber ?? '—'}</td>
                    <td className="px-4 py-3">{shipped}</td>
                    <td className="px-4 py-3">{received !== null ? received : '—'}</td>
                    <td className="px-4 py-3">
                      {variance !== null ? (
                        <span className={variance !== 0 ? 'text-amber-600' : 'text-green-600'}>
                          {variance > 0 ? '+' : ''}{variance}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {transfer.status === 'DRAFT' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-800">
            Review the transfer items above, then ship to deduct from origin stock.
          </p>
          <Button
            onClick={() => shipMutation.mutate()}
            disabled={shipMutation.isPending}
          >
            {shipMutation.isPending ? 'Shipping...' : 'Ship Transfer'}
          </Button>
        </div>
      )}

      {transfer.status === 'SHIPPED' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-800">
            Transfer is in transit. Receive at destination to add to stock.
          </p>
          <Button
            onClick={() => receiveMutation.mutate()}
            disabled={receiveMutation.isPending}
          >
            {receiveMutation.isPending ? 'Receiving...' : 'Receive Transfer'}
          </Button>
        </div>
      )}

      {transfer.status === 'RECEIVED' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            Transfer completed. All items have been received at destination.
          </p>
        </div>
      )}
    </div>
  );
}
