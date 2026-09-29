'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { catalogApi, Product } from '@/lib/api/catalog';
import { Branch, organizationApi } from '@/lib/api/organization';
import { procurementApi } from '@/lib/api/procurement';

export default function PurchaseOrdersPage() {
  const [warehouseId, setWarehouseId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [productUnitId, setProductUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; productUnitId: string; orderedQuantity: number; unitCost: number; label: string }>>([]);
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => organizationApi.listBranches() });
  const warehouses = useQuery({ queryKey: ['warehouses', branchId], queryFn: () => organizationApi.listWarehouses(branchId), enabled: !!branchId });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => procurementApi.listSuppliers() });
  const products = useQuery({ queryKey: ['products'], queryFn: () => catalogApi.listProducts({ limit: 100 }) });
  const product = useQuery({ queryKey: ['product-unit-detail', productId], queryFn: () => catalogApi.getProduct(productId), enabled: !!productId });
  const activeSuppliers = suppliers.data?.items.filter((s) => s.status === 'ACTIVE') ?? [];
  const units = product.data?.productUnits ?? [];
  const orders = useQuery({ queryKey: ['purchase-orders', warehouseId], queryFn: () => procurementApi.listPurchaseOrders(warehouseId), enabled: !!warehouseId });
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.orderedQuantity * line.unitCost, 0), [lines]);
  const create = useMutation({ mutationFn: () => procurementApi.createPurchaseOrder({ warehouseId, supplierId, notes, items: lines.map(({ label, ...item }) => item) }), onSuccess: (po) => { window.location.href = `/purchase-orders/${po.id}`; } });

  function addLine() {
    const selectedUnit = units.find((unit) => unit.id === productUnitId);
    const selectedProduct: Product | undefined = products.data?.items.find((p) => p.id === productId);
    if (!selectedProduct || !selectedUnit || Number(quantity) <= 0 || Number(unitCost) < 0) return;
    setLines((existing) => [...existing, { productId, productUnitId, orderedQuantity: Number(quantity), unitCost: Number(unitCost), label: `${selectedProduct.name} · ${selectedUnit.unit.symbol}` }]);
    setProductId(''); setProductUnitId(''); setQuantity(''); setUnitCost('');
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <header><h1 className="text-2xl font-bold">Purchase Orders</h1><p className="mt-1 text-sm text-slate-500">Create orders for the central warehouse and receive supplier deliveries.</p></header>
    <section className="space-y-4 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">New purchase order</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <select className="rounded-md border px-3 py-2 text-sm" value={branchId} onChange={(e) => { setBranchId(e.target.value); setWarehouseId(''); }}><option value="">Select branch</option>{(branches.data?.items ?? []).map((b: Branch) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="rounded-md border px-3 py-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}><option value="">Select warehouse</option>{(warehouses.data?.items ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <select className="rounded-md border px-3 py-2 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Select supplier</option>{activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="grid items-end gap-3 md:grid-cols-5">
        <select className="rounded-md border px-3 py-2 text-sm" value={productId} onChange={(e) => { setProductId(e.target.value); setProductUnitId(''); }}><option value="">Select product</option>{(products.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.skuCode} · {p.name}</option>)}</select>
        <select className="rounded-md border px-3 py-2 text-sm" value={productUnitId} onChange={(e) => setProductUnitId(e.target.value)} disabled={!productId}><option value="">Select unit</option>{units.map((u) => <option key={u.id} value={u.id}>{u.unit.name} ({u.unit.symbol})</option>)}</select>
        <Input type="number" min="0.000001" step="any" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input type="number" min="0" step="any" placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        <Button type="button" variant="outline" onClick={addLine}>Add item</Button>
      </div>
      {lines.length > 0 && <div className="space-y-2">{lines.map((line, index) => <div className="flex justify-between border-b py-2 text-sm" key={`${line.productId}-${index}`}><span>{line.label} · {line.orderedQuantity} × {line.unitCost.toFixed(2)}</span><Button type="button" size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove</Button></div>)}<p className="text-right text-sm font-semibold">Subtotal: {total.toFixed(2)}</p></div>}
      <Button disabled={!warehouseId || !supplierId || !lines.length} loading={create.isPending} onClick={() => create.mutate()}>Create draft PO</Button>
      {create.isError && <p className="text-sm text-red-600">{(create.error as Error).message}</p>}
    </section>
    {warehouseId && <section className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">PO</th><th className="p-3">Supplier</th><th className="p-3">Status</th><th className="p-3">Total</th></tr></thead><tbody>{(orders.data?.items ?? []).map((po) => <tr className="border-t" key={po.id}><td className="p-3"><Link className="text-blue-700 hover:underline" href={`/purchase-orders/${po.id}`}>{po.purchaseOrderNumber}</Link></td><td className="p-3">{po.supplier.name}</td><td className="p-3">{po.status}</td><td className="p-3">{Number(po.subtotal).toFixed(2)}</td></tr>)}</tbody></table></section>}
  </div>;
}
