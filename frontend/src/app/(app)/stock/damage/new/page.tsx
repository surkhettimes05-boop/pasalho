'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { damageApi, DamageType } from '@/lib/api/phase4';
import { organizationApi } from '@/lib/api/organization';
import { catalogApi, Product } from '@/lib/api/catalog';
import { api } from '@/lib/api/client';

const DAMAGE_TYPES: { value: DamageType; label: string }[] = [
  { value: 'PHYSICAL', label: 'Physical damage' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'WATER', label: 'Water damage' },
  { value: 'PEST', label: 'Pest damage' },
  { value: 'OTHER', label: 'Other' },
];

interface LineItem {
  productId: string;
  productName: string;
  batchId?: string;
  unitId: string;
  unitSymbol: string;
  quantity: number;
  baseQuantity: number;
  damageType: DamageType;
  notes: string;
}

export default function NewDamageReportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const branchesQ = useQuery({ queryKey: ['branches'], queryFn: () => organizationApi.listBranches() });
  const branches = branchesQ.data?.items ?? [];

  const warehousesQ = useQuery({
    queryKey: ['warehouses', branchId],
    queryFn: () => organizationApi.listWarehouses(branchId),
    enabled: !!branchId,
  });
  const warehouses = warehousesQ.data?.items ?? [];

  const productsQ = useQuery({
    queryKey: ['products-dmg', productSearch],
    queryFn: () => catalogApi.listProducts({ search: productSearch, limit: 20 }),
    enabled: productSearch.length > 0,
  });
  const products: Product[] = productsQ.data?.items ?? [];

  function addProduct(p: Product) {
    setLineItems((prev) => [...prev, {
      productId: p.id,
      productName: p.name,
      batchId: undefined,
      unitId: p.defaultUnitId,
      unitSymbol: p.defaultUnit?.symbol ?? '',
      quantity: 1,
      baseQuantity: 1,
      damageType: 'PHYSICAL',
      notes: '',
    }]);
    setProductSearch('');
  }

  const createMutation = useMutation({
    mutationFn: () => damageApi.create({
      branchId,
      warehouseId,
      locationId,
      reason,
      notes: notes || undefined,
      items: lineItems.map((li) => ({
        productId: li.productId,
        batchId: li.batchId || undefined,
        unitId: li.unitId,
        quantity: li.quantity,
        baseQuantity: li.baseQuantity,
        damageType: li.damageType,
        notes: li.notes || undefined,
      })),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['damage-reports'] });
      router.push(`/stock/damage/${data.id}`);
    },
  });

  const canSubmit = branchId && warehouseId && locationId && reason && lineItems.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Damage Report</h1>
        <p className="mt-1 text-sm text-slate-500">Report damaged stock. Requires approval before stock is deducted.</p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Location & Reason</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Branch</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setWarehouseId(''); setLocationId(''); }}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Warehouse</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                const wh = warehouses.find((w) => w.id === e.target.value);
                setLocationId(wh?.inventoryLocation?.id ?? '');
              }}
              disabled={!branchId}>
              <option value="">Select warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">Reason</label>
            <Input placeholder="e.g. Flood damage in warehouse section B" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
            <Input placeholder="Additional context" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Damaged Items</h2>
        <div className="relative">
          <Input placeholder="Search products to add..." className="w-80" value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)} />
          {productSearch && products.length > 0 && (
            <div className="absolute z-10 mt-1 w-80 rounded-lg border bg-white shadow-lg">
              {products.map((p) => (
                <button key={p.id} type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => addProduct(p)}>
                  <span>{p.name}</span>
                  <span className="text-xs text-gray-400">{p.skuCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-gray-400">
            Search and add damaged products above
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Qty</th>
                  <th className="px-3 py-3">Damage Type</th>
                  <th className="px-3 py-3">Notes</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((li, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3">{li.productName} <span className="text-gray-400 text-xs">({li.unitSymbol})</span></td>
                    <td className="px-3 py-3">
                      <Input type="number" min={0.001} step="0.01" className="w-20"
                        value={li.quantity || ''}
                        onChange={(e) => setLineItems((prev) => prev.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value), baseQuantity: Number(e.target.value) } : x))} />
                    </td>
                    <td className="px-3 py-3">
                      <select className="rounded border px-2 py-1 text-sm" value={li.damageType}
                        onChange={(e) => setLineItems((prev) => prev.map((x, j) => j === i ? { ...x, damageType: e.target.value as DamageType } : x))}>
                        {DAMAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <Input className="w-36 text-xs" placeholder="Notes"
                        value={li.notes}
                        onChange={(e) => setLineItems((prev) => prev.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" className="text-xs text-red-600 hover:underline"
                        onClick={() => setLineItems((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Report (DRAFT)'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
      {createMutation.isError && <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>}
    </div>
  );
}
