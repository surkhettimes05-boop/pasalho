'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { salesOrdersApi } from '@/lib/api/sales-orders';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

export default function OnlineOutboundPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['warehouse-outbound-online'],
    queryFn: () => salesOrdersApi.list({ source: 'STOREFRONT', limit: 100 }),
    refetchInterval: 30_000,
  });
  const orders = (data?.items ?? []).filter((order) => order.status !== 'CANCELLED' && order.status !== 'DELIVERED');

  return <div className="space-y-5">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Warehouse · Outbound</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Online Orders</h1>
      <p className="mt-1 text-sm text-slate-600">Online orders reserve Central Warehouse stock. Inventory is deducted once when an order is dispatched.</p>
    </header>
    {isLoading ? <Spinner /> : isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Online orders could not be loaded. Check warehouse access and try again.</p> : orders.length === 0 ? <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">No online orders are waiting for warehouse fulfillment.</div> : <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"></th></tr></thead>
        <tbody className="divide-y">{orders.map((order) => <tr key={order.id}>
          <td className="px-4 py-3 font-medium">{order.orderNo}</td><td className="px-4 py-3">{order.notes?.match(/"name":"([^"]+)/)?.[1] ?? 'Online customer'}</td>
          <td className="px-4 py-3">{order._count?.items ?? order.items.length}</td><td className="px-4 py-3">{formatCurrency(Number(order.grandTotal))}</td>
          <td className="px-4 py-3"><Badge className={statusVariant(order.status)}>{order.status}</Badge></td><td className="px-4 py-3">{formatDate(order.createdAt)}</td>
          <td className="px-4 py-3 text-right"><Link className="font-semibold text-blue-700 hover:underline" href={`/orders/${order.id}`}>Open order</Link></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
