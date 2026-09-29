'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { transferApi } from '@/lib/api/inventory';
import { formatDate } from '@/lib/utils/cn';

export default function StoreOutboundPage() {
  const transfers = useQuery({
    queryKey: ['warehouse-store-orders'],
    queryFn: () => transferApi.list({ page: 1, limit: 100 }),
    refetchInterval: 30_000,
  });
  const orders = (transfers.data?.items ?? []).filter((transfer) => transfer.status !== 'CANCELLED');

  return <div className="space-y-5">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Warehouse · Outbound</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Store Orders</h1>
      <p className="mt-1 text-sm text-slate-600">Review store stock requests, confirm, then dispatch. Store stock changes only when the destination confirms physical receipt.</p>
      <nav aria-label="Outbound order type" className="mt-4 flex flex-wrap gap-2">
        <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound">Online Orders</Link>
        <Link className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white" href="/warehouse/outbound/stores">Store Orders</Link>
        <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound/b2b">B2B Orders</Link>
        <Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound/franchise">Franchise Orders</Link>
      </nav>
    </header>
    {transfers.isLoading ? <Spinner /> : transfers.isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Store requests could not be loaded.</p> : orders.length === 0 ? <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">No store stock requests are waiting.</div> : <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Request</th><th className="px-4 py-3">Store</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th><th /></tr></thead>
        <tbody className="divide-y">{orders.map((order) => <tr key={order.id}><td className="px-4 py-3 font-medium">{order.transferNo}</td><td className="px-4 py-3">{order.toBranch?.name ?? 'Store'}</td><td className="px-4 py-3">{order.items?.length ? order.items.map((item) => <div key={item.id}>{item.product?.name ?? item.product?.skuCode ?? 'Product'} · {item.quantity} {item.unit?.symbol ?? ''}</div>) : '—'}</td><td className="px-4 py-3">{formatDate(order.createdAt)}</td><td className="px-4 py-3"><Badge className={statusVariant(order.status)}>{order.status}</Badge></td><td className="px-4 py-3 text-right"><Link className="font-semibold text-blue-700 hover:underline" href={`/transfers/${order.id}`}>Review / process</Link></td></tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
