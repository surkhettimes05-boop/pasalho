'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, statusVariant } from '@/components/ui/badge';
import { catalogApi } from '@/lib/api/catalog';
import { franchiseApi } from '@/lib/api/franchise';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

export default function FranchiseSupplyOrdersPage() {
  const qc = useQueryClient(); const [storeId, setStoreId] = useState(''); const [productId, setProductId] = useState(''); const [quantity, setQuantity] = useState('10');
  const stores = useQuery({ queryKey: ['franchise-stores'], queryFn: franchiseApi.listStores });
  const products = useQuery({ queryKey: ['franchise-products'], queryFn: () => catalogApi.listProducts({ page: 1, limit: 200 }) });
  const orders = useQuery({ queryKey: ['franchise-orders'], queryFn: franchiseApi.listOrders });
  const selectedProduct = products.data?.items.find((item) => item.id === productId);
  const create = useMutation({ mutationFn: () => franchiseApi.createOrder({ storeId, items: [{ productId, unitId: selectedProduct?.defaultUnitId, quantity: Number(quantity) }] }), onSuccess: () => { setProductId(''); setQuantity('10'); qc.invalidateQueries({ queryKey: ['franchise-orders'] }); qc.invalidateQueries({ queryKey: ['franchise-overview'] }); } });
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Supply Orders</h1><p className="mt-1 text-sm text-slate-600">Requests begin without a stock reservation. Approval reserves central warehouse stock; dispatch consumes it once.</p></header>
    <form className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><Select label="Franchise store" value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">Select store</option>{(stores.data ?? []).filter((s) => s.status === 'ACTIVE').map((s) => <option key={s.id} value={s.id}>{s.name} · {s.partnerName}</option>)}</Select><Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Select product</option>{(products.data?.items ?? []).filter((p) => p.isActive !== false).map((p) => <option key={p.id} value={p.id}>{p.skuCode} · {p.name}</option>)}</Select><Input label="Quantity" type="number" min="0.000001" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /><Button className="self-end" disabled={create.isPending || !storeId || !productId || Number(quantity) <= 0}>Request supply</Button>{create.isError && <p role="alert" className="text-sm text-red-700">{(create.error as Error).message}</p>}</form>
    <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Request</th><th className="p-3">Partner / Store</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Requested</th><th className="p-3">Status</th><th /></tr></thead><tbody className="divide-y">{(orders.data ?? []).map((order) => <tr key={order.id}><td className="p-3 font-semibold">{order.orderNumber}</td><td className="p-3">{order.partnerName} · {order.storeName}</td><td className="p-3">{order.items.reduce((sum, item) => sum + Number(item.quantity), 0)} units</td><td className="p-3">{order.totalAmount == null ? 'Unavailable' : formatCurrency(Number(order.totalAmount))}</td><td className="p-3">{formatDate(order.createdAt)}</td><td className="p-3"><Badge className={statusVariant(order.status)}>{order.status}</Badge></td><td className="p-3 text-right"><Link className="font-semibold text-blue-700 hover:underline" href={`/franchise/supply-orders/${order.id}`}>Open</Link></td></tr>)}</tbody></table></div>
  </div>;
}
