'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { franchiseApi } from '@/lib/api/franchise';
import { formatCurrency, formatDateTime } from '@/lib/utils/cn';

export default function FranchiseSupplyOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const qc = useQueryClient();
  const order = useQuery({ queryKey: ['franchise-order', id], queryFn: () => franchiseApi.getOrder(id) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['franchise-order', id] }); qc.invalidateQueries({ queryKey: ['franchise-orders'] }); qc.invalidateQueries({ queryKey: ['franchise-overview'] }); qc.invalidateQueries({ queryKey: ['warehouse-outbound-franchise'] }); };
  const action = useMutation({ mutationFn: (value: 'approve' | 'pick' | 'pack' | 'dispatch' | 'receive') => franchiseApi.transition(id, value), onSuccess: invalidate });
  if (order.isLoading) return <Spinner />;
  if (!order.data) return <p className="text-sm text-slate-600">Supply order not found.</p>;
  const item = order.data;
  const next = item.status === 'REQUESTED' ? ['approve', 'Approve request'] as const : item.status === 'APPROVED' ? ['pick', 'Start picking'] as const : item.status === 'PICKING' ? ['pack', 'Mark packed'] as const : item.status === 'PACKED' ? ['dispatch', 'Dispatch'] as const : item.status === 'DISPATCHED' ? ['receive', 'Confirm receipt'] as const : null;
  return <div className="mx-auto max-w-4xl space-y-5"><header className="flex flex-wrap items-start justify-between gap-3"><div><Link className="text-sm text-blue-700" href="/franchise/supply-orders">← Supply Orders</Link><h1 className="mt-2 text-2xl font-bold">{item.orderNumber}</h1><p className="mt-1 text-sm text-slate-600">{item.partnerName} · {item.storeName} · {item.storeAddress}</p></div><Badge className={statusVariant(item.status)}>{item.status}</Badge></header>
    <section className="rounded-lg border bg-white p-4"><h2 className="font-semibold">Requested products</h2><div className="mt-3 divide-y">{item.items.map((line) => <div key={line.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span><b>{line.sku}</b> · {line.productName}</span><span>{line.quantity} {line.unit}</span><span>{line.lineTotal == null ? 'Price unavailable' : formatCurrency(Number(line.lineTotal))}</span></div>)}</div><div className="mt-3 flex justify-between border-t pt-3 font-bold"><span>Total</span><span>{item.totalAmount == null ? 'Unavailable' : formatCurrency(Number(item.totalAmount))}</span></div>{item.supplyReference && <p className="mt-2 text-sm text-slate-600">Warehouse order reference: {item.supplyReference}</p>}</section>
    {next && <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><p className="mb-3 text-sm text-blue-900">{item.status === 'REQUESTED' ? 'Approval reserves stock without reducing physical on-hand.' : item.status === 'PACKED' ? 'Dispatch records the warehouse stock deduction exactly once.' : item.status === 'DISPATCHED' ? 'Confirm only after the franchise store has physically received the shipment.' : 'Continue the shared warehouse order lifecycle.'}</p><Button disabled={action.isPending} onClick={() => action.mutate(next[0])}>{action.isPending ? 'Saving…' : next[1]}</Button>{action.isError && <p role="alert" className="mt-3 text-sm text-red-700">{(action.error as Error).message}</p>}</section>}
    <section className="rounded-lg border bg-white p-4"><h2 className="font-semibold">Supply history</h2>{(item.history ?? []).map((event, index) => <div key={`${event.createdAt}-${index}`} className="border-t py-3 text-sm"><b>{event.fromStatus ? `${event.fromStatus} → ` : ''}{event.toStatus}</b><span className="ml-3 text-slate-500">{formatDateTime(event.createdAt)}</span>{event.notes && <p className="text-slate-600">{event.notes}</p>}</div>)}</section>
  </div>;
}
