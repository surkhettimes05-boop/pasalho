'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { salesOrdersApi } from '@/lib/api/sales-orders';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

export default function B2BOutboundPage() {
  const ordersQuery = useQuery({
    queryKey: ['warehouse-outbound-b2b'],
    queryFn: () => salesOrdersApi.list({ source: 'DNP', retailerOrder: true, limit: 100 }),
    refetchInterval: 30_000,
  });
  const orders = (ordersQuery.data?.items ?? []).filter((order) => order.status !== 'CANCELLED' && order.status !== 'DELIVERED');

  return <div className="space-y-5">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Warehouse · Outbound</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">B2B Orders</h1>
      <p className="mt-1 text-sm text-slate-600">Retailer orders with order totals and current fulfillment state. Open an order to continue its existing lifecycle.</p>
      <nav aria-label="Outbound order type" className="mt-4 flex flex-wrap gap-2">
        <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound">Online Orders</Link>
        <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound/stores">Store Orders</Link>
        <Link className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white" href="/warehouse/outbound/b2b">B2B Orders</Link>
        <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound/franchise">Franchise Orders</Link>
      </nav>
    </header>
    {ordersQuery.isLoading ? <Spinner /> : ordersQuery.isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">B2B orders could not be loaded.</p> : orders.length === 0 ? <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">No B2B orders are waiting for fulfillment.</div> : <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Retailer</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Payment / credit</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th /></tr></thead>
        <tbody className="divide-y">{orders.map((order) => <tr key={order.id}><td className="px-4 py-3 font-medium">{order.orderNo}</td><td className="px-4 py-3">{order.retailer?.shopName ?? 'Retailer'}</td><td className="px-4 py-3">{order._count?.items ?? order.items?.length ?? 0}</td><td className="px-4 py-3">{formatCurrency(Number(order.grandTotal))}</td><td className="px-4 py-3">{order.invoice ? `${order.invoice.paymentStatus ?? order.invoice.status} · paid ${formatCurrency(Number(order.invoice.paidAmount ?? 0))}` : 'Not invoiced'}</td><td className="px-4 py-3"><Badge className={statusVariant(order.status)}>{order.status}</Badge></td><td className="px-4 py-3">{formatDate(order.createdAt)}</td><td className="px-4 py-3 text-right"><Link className="font-semibold text-blue-700 hover:underline" href={`/orders/${order.id}`}>Open order</Link></td></tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
