'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { transferApi, inventoryApi } from '@/lib/api/inventory';
import { organizationApi, Branch, Warehouse } from '@/lib/api/organization';
import { catalogApi, Product } from '@/lib/api/catalog';

interface TransferLineItem {
  productId: string;
  batchId?: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
}

export default function NewTransferPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fromBranchId, setFromBranchId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<TransferLineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const branchesQ = useQuery({
    queryKey: ['branches'],
    queryFn: () => organizationApi.listBranches(),
  });
  const branches: Branch[] = branchesQ.data?.items ?? [];

  const fromWhQ = useQuery({
    queryKey: ['warehouses', fromBranchId],
    queryFn: () => organizationApi.listWarehouses(fromBranchId),
    enabled: !!fromBranchId,
  });
  const toWhQ = useQuery({
    queryKey: ['warehouses', toBranchId],
    queryFn: () => organizationApi.listWarehouses(toBranchId),
    enabled: !!toBranchId,
  });

  const productsQ = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => catalogApi.listProducts({ search: productSearch, limit: 20 }),
  });
  const products: Product[] = productsQ.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      transferApi.create({
        fromBranchId,
        fromWarehouseId,
        fromLocationId,
        toBranchId,
        toWarehouseId,
        toLocationId,
        notes,
        items: lineItems.map((li) => ({
          productId: li.productId,
          batchId: li.batchId || undefined,
          unitId: li.unitId,
          stockState: 'AVAILABLE',
          quantity: li.quantity,
          baseQuantity: li.baseQuantity,
        })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      router.push(`/transfers/${data.id}`);
    },
  });

  function addLineItem(product: Product) {
    // Use first active batch or no batch
    const batch = product.batches?.[0];
    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        batchId: batch?.id,
        unitId: product.defaultUnitId,
        quantity: 0,
        baseQuantity: 0,
      },
    ]);
  }

  function updateLineItem(index: number, field: string, value: any) {
    setLineItems((prev) => {
      const next = [...prev];
      (next[index] as any)[field] = value;
      // Keep baseQuantity in sync with quantity by default
      if (field === 'quantity') {
        next[index].baseQuantity = Number(value);
      }
      return next;
    });
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Stock Transfer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Move stock between warehouses or branches
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Origin Branch</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={fromBranchId}
            onChange={(e) => { setFromBranchId(e.target.value); setFromWarehouseId(''); setFromLocationId(''); }}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Origin Warehouse</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={fromWarehouseId}
            onChange={(e) => { setFromWarehouseId(e.target.value); setFromLocationId(e.target.value); }}
            disabled={!fromBranchId}
          >
            <option value="">Select warehouse</option>
            {(fromWhQ.data?.items ?? []).map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Destination Branch</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={toBranchId}
            onChange={(e) => { setToBranchId(e.target.value); setToWarehouseId(''); setToLocationId(''); }}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Destination Warehouse</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={toWarehouseId}
            onChange={(e) => { setToWarehouseId(e.target.value); setToLocationId(e.target.value); }}
            disabled={!toBranchId}
          >
            <option value="">Select warehouse</option>
            {(toWhQ.data?.items ?? []).map((w: any) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2 text-sm"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this transfer"
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Items to Transfer</h2>
        <Input
          placeholder="Search products to add..."
          className="mb-3 w-80"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />
        {productSearch && (
          <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => addLineItem(p)}
              >
                <span>{p.name}</span>
                <span className="text-xs text-gray-400">{p.skuCode}</span>
              </button>
            ))}
            {products.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-400">No products found</div>
            )}
          </div>
        )}

        {lineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-400">
            Search and select products above to add transfer items
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((li, i) => {
                  const p = products.find((x) => x.id === li.productId);
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3">{p?.name ?? li.productId}</td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-24"
                          value={li.quantity || ''}
                          onChange={(e) => updateLineItem(i, 'quantity', Number(e.target.value))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => removeLineItem(i)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!fromBranchId || !toBranchId || lineItems.length === 0 || createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
