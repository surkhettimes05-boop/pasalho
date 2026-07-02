'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { formatCurrency, formatDate } from '@/lib/utils/cn';
import { retailerOrderApi } from '@/lib/api/retailer-portal';

export default function RetailerOrderDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['retailer-order', id],
    queryFn: () => retailerOrderApi.findById(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => retailerOrderApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer-order', id] });
      queryClient.invalidateQueries({ queryKey: ['retailer-orders'] });
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !order) {
    return (
      <div className="py-12 text-center text-sm text-red-500">
        {error instanceof Error ? error.message : 'Order not found'}
      </div>
    );
  }

  const canCancel = order.status === 'DRAFT' || order.status === 'CONFIRMED';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{order.orderNo}</h1>
          <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
        </div>
        <Badge className={statusVariant(order.status)}>{order.status}</Badge>
      </div>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Items ({order.items?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {order.items && order.items.length > 0 ? (
            <div className="divide-y">
              <div className="flex items-center gap-3 pb-2 text-xs font-medium text-gray-500">
                <div className="flex-1">Product</div>
                <div className="w-16 text-right">Qty</div>
                <div className="w-20 text-right">Price</div>
                <div className="w-20 text-right">Total</div>
              </div>
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {item.product?.name ?? 'Unknown Product'}
                    </p>
                    <p className="text-xs text-gray-500">{item.unit?.symbol}</p>
                  </div>
                  <div className="w-16 text-right text-gray-700">{item.quantity}</div>
                  <div className="w-20 text-right text-gray-700">
                    {formatCurrency(Number(item.unitPrice))}
                  </div>
                  <div className="w-20 text-right font-medium text-gray-900">
                    {formatCurrency(Number(item.lineTotal))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No items</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-900">{formatCurrency(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base">
            <span className="font-semibold text-gray-900">Grand Total</span>
            <span className="font-bold text-gray-900">{formatCurrency(Number(order.grandTotal))}</span>
          </div>
        </CardContent>
      </Card>

      {order.invoiceId && (
        <Link href={`/invoices/${order.invoiceId}`}>
          <Button variant="outline" className="w-full">View Invoice</Button>
        </Link>
      )}

      {canCancel && (
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (window.confirm('Are you sure you want to cancel this order?')) {
              cancelMutation.mutate();
            }
          }}
          loading={cancelMutation.isPending}
        >
          Cancel Order
        </Button>
      )}

      {cancelMutation.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(cancelMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
