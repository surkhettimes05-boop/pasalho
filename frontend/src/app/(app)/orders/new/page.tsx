'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { salesOrdersApi } from '@/lib/api/sales-orders';
import { organizationApi } from '@/lib/api/organization';
import { salesApi, Retailer } from '@/lib/api/sales';
import { catalogApi, Product } from '@/lib/api/catalog';
import { formatCurrency } from '@/lib/utils/cn';

interface LineItem {
  productId: string;
  productName: string;
  batchId?: string;
  unitId: string;
  unitSymbol: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [routeId, setRouteId] = useState(searchParams.get('routeId') ?? '');
  const [retailerId, setRetailerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const branchesQ = useQuery({ queryKey: ['branches'], queryFn: () => organizationApi.listBranches() });
  const branches = branchesQ.data?.items ?? [];

  const salesRepsQ = useQuery({
    queryKey: ['sales-reps'],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/sales-reps?limit=100`, {
      headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pasalo_token') : ''}` },
    }).then(r => r.json()).then(r => r.data),
  });
  const salesReps = salesRepsQ.data?.items ?? [];

  const retailersQ = useQuery({
    queryKey: ['retailers-search', branchId],
    queryFn: () => salesApi.listRetailers({ limit: 200 }),
  });
  const retailers: Retailer[] = retailersQ.data?.items ?? [];

  const routesQ = useQuery({
    queryKey: ['routes-dropdown', branchId],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/routes?branchId=${branchId}&limit=100`, {
      headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pasalo_token') : ''}` },
    }).then(r => r.json()).then(r => r.data),
    enabled: !!branchId,
  });
  const routes = routesQ.data?.items ?? [];

  const productsQ = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => catalogApi.listProducts({ search: productSearch, limit: 20 }),
    enabled: productSearch.length > 0,
  });
  const products: Product[] = productsQ.data?.items ?? [];

  function addLineItem(product: Product) {
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        batchId: (product as any).batches?.[0]?.id,
        unitId: product.defaultUnitId,
        unitSymbol: product.defaultUnit?.symbol ?? '',
        quantity: 1,
        baseQuantity: 1,
        unitPrice: Number(product.mrp ?? 0),
      },
    ]);
    setProductSearch('');
  }

  function updateItem(idx: number, field: string, value: number) {
    setLineItems((prev) => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (field === 'quantity') next[idx].baseQuantity = value;
      return next;
    });
  }

  const grandTotal = lineItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      salesOrdersApi.create({
        branchId,
        salesRepId,
        routeId: routeId || undefined,
        retailerId,
        notes: notes || undefined,
        items: lineItems.map((li) => ({
          productId: li.productId,
          batchId: li.batchId || undefined,
          unitId: li.unitId,
          quantity: li.quantity,
          baseQuantity: li.baseQuantity,
          unitPrice: li.unitPrice,
        })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      router.push(`/orders/${data.id}`);
    },
  });

  const canSubmit = branchId && salesRepId && retailerId && lineItems.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Sales Order</h1>
        <p className="mt-1 text-sm text-slate-500">Capture a retailer order on route</p>
      </div>

      {/* Header */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Branch</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Sales Rep</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={salesRepId} onChange={(e) => setSalesRepId(e.target.value)}>
            <option value="">Select sales rep</option>
            {salesReps.map((r: any) => <option key={r.id} value={r.id}>{r.user?.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Retailer</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
            <option value="">Select retailer</option>
            {retailers.map((r) => <option key={r.id} value={r.id}>{r.shopName} – {r.ownerName}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Route (optional)</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={routeId} onChange={(e) => setRouteId(e.target.value)} disabled={!branchId}>
            <option value="">No route</option>
            {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <Input placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Products */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">Order Items</h2>
        <div className="relative mb-3">
          <Input
            placeholder="Search products to add..."
            className="w-80"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productSearch && products.length > 0 && (
            <div className="absolute z-10 mt-1 w-80 rounded-lg border bg-white shadow-lg">
              {products.map((p) => (
                <button key={p.id} type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => addLineItem(p)}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-gray-400">{p.skuCode} · {formatCurrency(Number(p.mrp))}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-gray-400">
            Search products above to add order items
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((li, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">{li.productName}</td>
                    <td className="px-4 py-3 text-gray-500">{li.unitSymbol}</td>
                    <td className="px-4 py-3">
                      <Input type="number" min={0.001} step="0.01" className="w-24"
                        value={li.quantity || ''}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
                    </td>
                    <td className="px-4 py-3">
                      <Input type="number" min={0} step="0.01" className="w-28"
                        value={li.unitPrice || ''}
                        onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} />
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(li.quantity * li.unitPrice)}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="text-xs text-red-600 hover:underline"
                        onClick={() => setLineItems((prev) => prev.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold">Grand Total</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
          {createMutation.isPending ? 'Saving...' : 'Save Order'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
      )}
    </div>
  );
}
