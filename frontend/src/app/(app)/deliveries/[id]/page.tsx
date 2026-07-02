'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { deliveriesApi } from '@/lib/api/deliveries';
import { formatDate, formatDateTime } from '@/lib/utils/cn';

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => deliveriesApi.findById(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['delivery', id] });
    queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };

  const dispatchMutation = useMutation({ mutationFn: () => deliveriesApi.dispatch(id), onSuccess: invalidate });
  const completeMutation = useMutation({ mutationFn: () => deliveriesApi.complete(id), onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: () => deliveriesApi.cancel(id), onSuccess: invalidate });
  const markItemMutation = useMutation({
    mutationFn: (itemId: string) => deliveriesApi.markItemDelivered(id, itemId),
    onSuccess: invalidate,
  });

  if (isLoading) return <Spinner />;
  if (!delivery) return <div className="py-12 text-center text-gray-500">Delivery not found.</div>;

  const deliveredCount = delivery.items.filter((i) => i.isDelivered).length;
  const totalCount = delivery.items.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{delivery.deliveryNo}</h1>
            <Badge className={statusVariant(delivery.status)}>{delivery.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Created {formatDate(delivery.createdAt)} by {delivery.createdBy?.fullName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/deliveries')}>Back</Button>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Route</p>
          <p className="mt-1 font-semibold">{delivery.route?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Driver</p>
          <p className="mt-1 font-semibold">{delivery.driverName ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Vehicle</p>
          <p className="mt-1 font-mono">{delivery.vehicleRef ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Scheduled</p>
          <p className="mt-1 font-semibold">{delivery.scheduledAt ? formatDate(delivery.scheduledAt) : '—'}</p>
        </div>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Delivery Progress</span>
            <span className="text-gray-500">{deliveredCount} / {totalCount} delivered</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${totalCount ? (deliveredCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        {delivery.dispatchedAt && (
          <div className="rounded border bg-blue-50 p-3">
            <p className="font-semibold text-blue-700">Dispatched</p>
            <p className="text-gray-500">{formatDateTime(delivery.dispatchedAt)}</p>
          </div>
        )}
        {delivery.completedAt && (
          <div className="rounded border bg-green-50 p-3">
            <p className="font-semibold text-green-700">Completed</p>
            <p className="text-gray-500">{formatDateTime(delivery.completedAt)}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {delivery.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
          <p className="mt-1 text-sm">{delivery.notes}</p>
        </div>
      )}

      {/* Items */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Delivery Items</h2>
        {delivery.items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-400">
            No items added to this delivery.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Retailer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Delivered</th>
                  {delivery.status === 'IN_TRANSIT' && <th className="px-4 py-3">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {delivery.items.map((item) => (
                  <tr key={item.id} className={item.isDelivered ? 'bg-green-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium">{item.retailer?.shopName}</td>
                    <td className="px-4 py-3 text-gray-500">{item.retailer?.phone}</td>
                    <td className="px-4 py-3">
                      {item.invoice ? (
                        <a href={`/invoices/${item.invoice.id}`} className="text-blue-600 hover:underline">
                          {item.invoice.invoiceNumber}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{item.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      {item.isDelivered ? (
                        <span className="text-xs font-medium text-green-600">✓ Done</span>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                    {delivery.status === 'IN_TRANSIT' && (
                      <td className="px-4 py-3">
                        {!item.isDelivered && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markItemMutation.mutate(item.id)}
                            disabled={markItemMutation.isPending}
                          >
                            Mark Delivered
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Banners */}
      {delivery.status === 'PENDING' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-800">Ready to dispatch. This will set the delivery to In Transit.</p>
          <div className="flex gap-3">
            <Button onClick={() => dispatchMutation.mutate()} disabled={dispatchMutation.isPending}>
              {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Now'}
            </Button>
            <Button variant="outline" onClick={() => { if (confirm('Cancel this delivery?')) cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}>
              Cancel Delivery
            </Button>
          </div>
        </div>
      )}

      {delivery.status === 'IN_TRANSIT' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-800">
            Delivery is in progress. Mark items above as delivered, then complete the run.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? 'Completing...' : 'Complete Delivery'}
            </Button>
            <Button variant="outline" onClick={() => { if (confirm('Cancel this delivery?')) cancelMutation.mutate(); }}
              disabled={cancelMutation.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
