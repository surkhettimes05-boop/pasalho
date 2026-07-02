'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { salesOrdersApi } from '@/lib/api/sales-orders';
import { organizationApi } from '@/lib/api/organization';
import { formatDate, formatCurrency } from '@/lib/utils/cn';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [sourceLocationId, setSourceLocationId] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => salesOrdersApi.findById(id),
  });

  const warehousesQ = useQuery({
    queryKey: ['warehouses', order?.branchId],
    queryFn: () => organizationApi.listWarehouses(order!.branchId),
    enabled: !!order?.branchId && showConvertModal,
  });
  const warehouses = warehousesQ.data?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
  };

  const confirmMutation = useMutation({ mutationFn: () => salesOrdersApi.confirm(id), onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: () => salesOrdersApi.cancel(id), onSuccess: invalidate });
  const convertMutation = useMutation({
    mutationFn: () => salesOrdersApi.convertToInvoice(id, { warehouseId, sourceLocationId }),
    onSuccess: () => { invalidate(); setShowConvertModal(false); },
  });

  if (isLoading) return <Spinner />;
  if (!order) return <div className="py-12 text-center text-gray-500">Order not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.orderNo}</h1>
            <Badge className={statusVariant(order.status)}>{order.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Created {formatDate(order.createdAt)} by {order.createdBy?.fullName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/orders')}>Back</Button>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Retailer</p>
          <p className="mt-1 font-semibold">{order.retailer?.shopName}</p>
          <p className="text-xs text-gray-400">{order.retailer?.phone}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sales Rep</p>
          <p className="mt-1 font-semibold">{order.salesRep?.user?.fullName ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Route</p>
          <p className="mt-1 font-semibold">{order.route?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Grand Total</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(Number(order.grandTotal))}</p>
        </div>
      </div>

      {/* Linked Invoice */}
      {order.invoice && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Linked to Invoice:{' '}
            <a href={`/invoices/${order.invoice.id}`} className="underline">
              {order.invoice.invoiceNumber}
            </a>
            {' '}— <Badge className={statusVariant(order.invoice.status)}>{order.invoice.status}</Badge>
          </p>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
          <p className="mt-1 text-sm">{order.notes}</p>
        </div>
      )}

      {/* Items */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Order Items</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit Price</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.batch?.batchNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit?.symbol}</td>
                  <td className="px-4 py-3">{Number(item.quantity)}</td>
                  <td className="px-4 py-3">{formatCurrency(Number(item.unitPrice))}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(item.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={5} className="px-4 py-3 text-right font-semibold">Grand Total</td>
                <td className="px-4 py-3 font-bold">{formatCurrency(Number(order.grandTotal))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action Banners */}
      {order.status === 'DRAFT' && (
        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
            {confirmMutation.isPending ? 'Confirming...' : 'Confirm Order'}
          </Button>
          <Button variant="outline" onClick={() => { if (confirm('Cancel this order?')) cancelMutation.mutate(); }}
            disabled={cancelMutation.isPending}>
            Cancel
          </Button>
        </div>
      )}

      {order.status === 'CONFIRMED' && !order.invoiceId && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-800">Order confirmed. Convert to invoice to process stock deduction.</p>
          <Button onClick={() => setShowConvertModal(true)}>Convert to Invoice</Button>
        </div>
      )}

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Select Warehouse to Invoice From</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Warehouse</label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm" value={warehouseId}
                  onChange={(e) => {
                    const wh = warehouses.find((w: any) => w.id === e.target.value);
                    setWarehouseId(e.target.value);
                    setSourceLocationId((wh as any)?.inventoryLocation?.id ?? '');
                  }}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => convertMutation.mutate()}
                disabled={!warehouseId || !sourceLocationId || convertMutation.isPending}
              >
                {convertMutation.isPending ? 'Converting...' : 'Convert'}
              </Button>
              <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
            </div>
            {convertMutation.isError && (
              <p className="mt-2 text-xs text-red-600">{(convertMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
