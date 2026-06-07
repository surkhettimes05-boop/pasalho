'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { catalogApi, Product } from '@/lib/api/catalog';
import { organizationApi, Warehouse } from '@/lib/api/organization';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/toaster';
import { formatDate } from '@/lib/utils/cn';

const REASONS = [
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'COUNT_CORRECTION', label: 'Count correction' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewAdjustmentPage() {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [quantityDelta, setQuantityDelta] = useState('');
  const [reasonCode, setReasonCode] = useState('DAMAGE');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const warehousesQ = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => (await organizationApi.listWarehouses()).items,
  });

  const productsQ = useQuery({
    queryKey: ['products-for-adjustment', debouncedProductSearch],
    queryFn: () =>
      catalogApi.listProducts({
        search: debouncedProductSearch || undefined,
        limit: 20,
      }),
  });

  const productDetailQ = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: () => catalogApi.getProduct(productId),
    enabled: !!productId,
  });

  useEffect(() => {
    if (productDetailQ.data?.defaultUnitId) {
      setUnitId(productDetailQ.data.defaultUnitId);
    }
  }, [productDetailQ.data]);

  // Pull batches from the product detail endpoint (which has embedded batches)
  const productBatchesQ = useQuery({
    queryKey: ['product-batches', productId],
    queryFn: async () => {
      const detail: any = await api.get(`/catalog/products/${productId}`);
      return (detail?.batches ?? []) as { id: string; batchCode: string; expiryDate?: string }[];
    },
    enabled: !!productId,
  });

  const productBatches = useMemo(() => productBatchesQ.data ?? [], [productBatchesQ.data]);

  const createMut = useMutation({
    mutationFn: async () => {
      const body: any = {
        warehouseId,
        productId,
        unitId,
        quantityDelta: Number(quantityDelta),
        reasonCode,
      };
      if (batchId) body.batchId = batchId;
      if (notes.trim()) body.notes = notes.trim();
      return api.post('/inventory/adjustments', body);
    },
    onSuccess: () => {
      toast({ title: 'Adjustment created (DRAFT)', variant: 'success' });
      router.push('/stock/adjustments');
    },
    onError: (e: Error) =>
      toast({ title: 'Failed to create', description: e.message, variant: 'error' }),
  });

  const canSubmit =
    !!warehouseId &&
    !!productId &&
    !!unitId &&
    quantityDelta.trim() !== '' &&
    !Number.isNaN(Number(quantityDelta));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast({ title: 'Fill all required fields', variant: 'error' });
      return;
    }
    createMut.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Stock Adjustment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a DRAFT adjustment. Submit → Approve → Post to commit to stock.
          </p>
        </div>
        <Link href="/stock/adjustments">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
              >
                <option value="">
                  {warehousesQ.isLoading ? 'Loading...' : 'Select warehouse'}
                </option>
                {(warehousesQ.data ?? []).map((w: Warehouse) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>

              <Select
                label="Reason"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                required
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Product</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input
                  label="Search product"
                  placeholder="Type name or SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                {debouncedProductSearch && productsQ.data && productsQ.data.items.length > 0 && !productId ? (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white">
                    {productsQ.data.items.map((p: Product) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setProductId(p.id);
                          setProductSearch(p.name);
                        }}
                      >
                        <span className="font-mono text-xs text-slate-500">{p.skuCode}</span>{' '}
                        <span className="text-slate-900">{p.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <Input
                label="Unit ID"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                placeholder="auto-filled from product"
                required
              />

              {productBatches.length > 0 ? (
                <Select
                  label="Batch (optional)"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                >
                  <option value="">No batch</option>
                  {productBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchCode} {b.expiryDate ? `(exp ${formatDate(b.expiryDate)})` : ''}
                    </option>
                  ))}
                </Select>
              ) : null}

              <Input
                label="Quantity delta"
                type="number"
                step="0.001"
                value={quantityDelta}
                onChange={(e) => setQuantityDelta(e.target.value)}
                placeholder="e.g. -5 for write-off, +10 for found"
                required
              />

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional context (shelf, batch, customer complaint, etc.)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link href="/stock/adjustments">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={createMut.isPending} disabled={!canSubmit}>
            Create DRAFT
          </Button>
        </div>

        {createMut.isError ? (
          <p className="text-sm text-red-600">{(createMut.error as Error).message}</p>
        ) : null}
      </form>
    </div>
  );
}
