'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { franchiseApi } from '@/lib/api/franchise';

export default function FranchiseOverviewPage() {
  const overview = useQuery({ queryKey: ['franchise-overview'], queryFn: franchiseApi.overview });
  const orders = useQuery({ queryKey: ['franchise-orders'], queryFn: franchiseApi.listOrders });
  const value = overview.data as { activePartners?: number; activeStores?: number; ordersByStatus?: Record<string, number>; suppliedValue?: number | null } | undefined;
  const waiting = (value?.ordersByStatus?.REQUESTED ?? 0) + (value?.ordersByStatus?.APPROVED ?? 0) + (value?.ordersByStatus?.PICKING ?? 0) + (value?.ordersByStatus?.PACKED ?? 0);
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Franchise Overview</h1><p className="mt-1 text-sm text-slate-600">Partner, store, supply order, and fulfilled-value totals from franchise records.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Active partners', value?.activePartners ?? '—'], ['Active stores', value?.activeStores ?? '—'], ['Open supply orders', waiting], ['Supplied value', value?.suppliedValue == null ? 'Unavailable' : `NPR ${value.suppliedValue.toFixed(2)}`]].map(([label, amount]) => <div className="rounded-lg border bg-white p-4" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{amount}</p></div>)}</section>
    <section className="rounded-lg border bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent Supply Orders</h2><Link className="text-sm font-semibold text-blue-700" href="/franchise/supply-orders">View all</Link></div>{orders.data?.slice(0, 6).map((order) => <Link key={order.id} href={`/franchise/supply-orders/${order.id}`} className="flex justify-between gap-4 border-t py-3 text-sm"><span><b>{order.orderNumber}</b> · {order.storeName}</span><span>{order.status}</span></Link>)}</section>
  </div>;
}
