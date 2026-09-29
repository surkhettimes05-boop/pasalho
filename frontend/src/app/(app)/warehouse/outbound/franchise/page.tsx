'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { franchiseApi, FranchiseStatus } from '@/lib/api/franchise';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

function actionFor(status: FranchiseStatus): 'approve' | 'pick' | 'pack' | 'dispatch' | null {
  if (status === 'REQUESTED') return 'approve';
  if (status === 'APPROVED') return 'pick';
  if (status === 'PICKING') return 'pack';
  if (status === 'PACKED') return 'dispatch';
  return null;
}
const labelFor = (action: string) => ({ approve: 'Approve', pick: 'Start picking', pack: 'Mark packed', dispatch: 'Dispatch' }[action] ?? action);

export default function FranchiseOutboundPage() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ['warehouse-outbound-franchise'], queryFn: franchiseApi.listOrders, refetchInterval: 30_000 });
  const transition = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'approve' | 'pick' | 'pack' | 'dispatch' }) => franchiseApi.transition(id, action), onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouse-outbound-franchise'] }); qc.invalidateQueries({ queryKey: ['franchise-orders'] }); qc.invalidateQueries({ queryKey: ['franchise-overview'] }); } });
  const queue = (orders.data ?? []).filter((order) => !['RECEIVED', 'CANCELLED'].includes(order.status));
  return <div className="space-y-5"><header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Warehouse · Outbound</p><h1 className="mt-1 text-2xl font-bold">Franchise Orders</h1><p className="mt-1 text-sm text-slate-600">Approve to reserve central stock. Dispatch deducts stock once; franchise store receipt completes the supply order.</p><nav aria-label="Outbound order type" className="mt-4 flex flex-wrap gap-2"><Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound">Online Orders</Link><Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound/stores">Store Orders</Link><Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/warehouse/outbound/b2b">B2B Orders</Link><Link className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white" href="/warehouse/outbound/franchise">Franchise Orders</Link></nav></header>
    {orders.isLoading ? <Spinner /> : orders.isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Franchise orders could not be loaded.</p> : queue.length === 0 ? <div className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">No franchise orders are awaiting warehouse processing.</div> : <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Order</th><th className="p-3">Partner / Store</th><th className="p-3">Items / Qty</th><th className="p-3">Amount</th><th className="p-3">Requested</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{queue.map((order) => { const action = actionFor(order.status); return <tr key={order.id}><td className="p-3 font-semibold"><Link className="text-blue-700 hover:underline" href={`/franchise/supply-orders/${order.id}`}>{order.orderNumber}</Link></td><td className="p-3">{order.partnerName} · {order.storeName}</td><td className="p-3">{order.items.length} lines · {order.items.reduce((sum, item) => sum + Number(item.quantity), 0)} units</td><td className="p-3">{order.totalAmount == null ? 'Unavailable' : formatCurrency(Number(order.totalAmount))}</td><td className="p-3">{formatDate(order.createdAt)}</td><td className="p-3"><Badge className={statusVariant(order.status)}>{order.status}</Badge></td><td className="p-3">{action && <Button size="sm" disabled={transition.isPending} onClick={() => transition.mutate({ id: order.id, action })}>{labelFor(action)}</Button>}</td></tr>; })}</tbody></table></div>}
    {transition.isError && <p role="alert" className="text-sm text-red-700">{(transition.error as Error).message}</p>}
  </div>;
}
