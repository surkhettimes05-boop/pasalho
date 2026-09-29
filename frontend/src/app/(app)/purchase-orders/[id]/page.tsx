'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { procurementApi, PurchaseOrderItem } from '@/lib/api/procurement';

type ReceiptLine = { receivedQuantity: string; acceptedQuantity: string; batchNumber: string; expiryDate: string };

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const [receiptLines, setReceiptLines] = useState<Record<string, ReceiptLine>>({});
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const idempotencyStorageKey = `pasalo_goods_receipt_key_${id}`;
  useEffect(() => {
    let key = localStorage.getItem(idempotencyStorageKey);
    if (!key) { key = crypto.randomUUID(); localStorage.setItem(idempotencyStorageKey, key); }
    setIdempotencyKey(key);
  }, [idempotencyStorageKey]);
  const po = useQuery({ queryKey: ['purchase-order', id], queryFn: () => procurementApi.getPurchaseOrder(id) });
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['purchase-order', id] }), qc.invalidateQueries({ queryKey: ['purchase-orders'] })]); };
  const confirm = useMutation({ mutationFn: () => procurementApi.confirmPurchaseOrder(id), onSuccess: refresh });
  const receive = useMutation({
    mutationFn: () => procurementApi.receive(id, (po.data?.items ?? []).flatMap((item) => {
      const line = receiptLines[item.id];
      if (!line || Number(line.receivedQuantity) <= 0) return [];
      return [{ purchaseOrderItemId: item.id, receivedQuantity: Number(line.receivedQuantity), acceptedQuantity: Number(line.acceptedQuantity), batchNumber: line.batchNumber || undefined, expiryDate: line.expiryDate || undefined }];
    }), idempotencyKey),
    onSuccess: async () => { setReceiptLines({}); const nextKey = crypto.randomUUID(); localStorage.setItem(idempotencyStorageKey, nextKey); setIdempotencyKey(nextKey); await refresh(); },
  });

  function updateLine(item: PurchaseOrderItem, key: keyof ReceiptLine, value: string) {
    setReceiptLines((current) => ({ ...current, [item.id]: Object.assign({ receivedQuantity: '', acceptedQuantity: '', batchNumber: '', expiryDate: '' }, current[item.id] ?? {}, { [key]: value }) }));
  }

  if (po.isLoading) return <p className="p-6 text-sm text-slate-500">Loading purchase order…</p>;
  if (po.isError || !po.data) return <p className="p-6 text-sm text-red-600">{(po.error as Error)?.message ?? 'Purchase order not found.'}</p>;
  const order = po.data;
  const canReceive = ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status);
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><button className="mb-2 text-sm text-blue-700" onClick={() => router.push('/purchase-orders')}>← Purchase Orders</button><h1 className="text-2xl font-bold">{order.purchaseOrderNumber}</h1><p className="mt-1 text-sm text-slate-500">{order.supplier.name} · {order.warehouse.name} · {order.status}</p></div>{order.status === 'DRAFT' && <Button loading={confirm.isPending} onClick={() => confirm.mutate()}>Confirm purchase order</Button>}</header>
    {(confirm.isError || receive.isError) && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{((confirm.error || receive.error) as Error).message}</p>}
    <section className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Product</th><th className="p-3">Ordered</th><th className="p-3">Accepted</th><th className="p-3">Remaining</th><th className="p-3">Unit cost</th></tr></thead><tbody>{order.items.map((item) => { const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity); return <tr key={item.id} className="border-t"><td className="p-3">{item.product.skuCode} · {item.product.name} ({item.productUnit.unit.symbol})</td><td className="p-3">{Number(item.orderedQuantity)}</td><td className="p-3">{Number(item.receivedQuantity)}</td><td className="p-3">{remaining}</td><td className="p-3">{Number(item.unitCost).toFixed(2)}</td></tr>; })}</tbody></table></section>
    {canReceive && <section className="space-y-4 rounded-lg border bg-white p-4"><h2 className="font-semibold">Receive supplier delivery</h2><p className="text-sm text-slate-500">Only accepted quantities increase warehouse stock. For batch-tracked items, enter the supplier batch number.</p>
      {order.items.filter((item) => Number(item.orderedQuantity) > Number(item.receivedQuantity)).map((item) => {
        const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity);
        const line = receiptLines[item.id] ?? { receivedQuantity: '', acceptedQuantity: '', batchNumber: '', expiryDate: '' };
        return <div className="grid gap-2 border-b pb-4 md:grid-cols-5" key={item.id}>
          <div className="self-center text-sm font-medium">{item.product.name}<span className="block text-xs text-slate-500">Remaining {remaining} {item.productUnit.unit.symbol}</span></div>
          <Input type="number" min="0.000001" max={remaining} step="any" placeholder="Delivered qty" value={line.receivedQuantity} onChange={(e) => { updateLine(item, 'receivedQuantity', e.target.value); if (!line.acceptedQuantity) updateLine(item, 'acceptedQuantity', e.target.value); }} />
          <Input type="number" min="0" max={line.receivedQuantity || remaining} step="any" placeholder="Accepted qty" value={line.acceptedQuantity} onChange={(e) => updateLine(item, 'acceptedQuantity', e.target.value)} />
          {item.product.isBatchTracked ? <Input placeholder="Batch number" value={line.batchNumber} onChange={(e) => updateLine(item, 'batchNumber', e.target.value)} /> : <span />}
          {item.product.isBatchTracked && item.product.isExpiryTracked && <Input type="date" value={line.expiryDate} onChange={(e) => updateLine(item, 'expiryDate', e.target.value)} />}
        </div>;
      })}
      <Button disabled={!idempotencyKey} loading={receive.isPending} onClick={() => receive.mutate()}>Post goods receipt</Button>
    </section>}
    <section className="space-y-3"><h2 className="font-semibold">Posted receipts</h2>{(order.goodsReceipts ?? []).map((receipt: any) => <div key={receipt.id} className="rounded-lg border bg-white p-4"><div className="flex justify-between text-sm font-medium"><span>{receipt.receiptNumber}</span><span>{new Date(receipt.receivedAt).toLocaleString()}</span></div><div className="mt-2 space-y-1 text-sm text-slate-600">{receipt.items.map((item: any) => <p key={item.id}>{item.productId} · accepted {Number(item.acceptedQuantity)} / delivered {Number(item.receivedQuantity)}</p>)}</div></div>)}{!order.goodsReceipts?.length && <p className="text-sm text-slate-500">No receipts yet.</p>}</section>
  </div>;
}
