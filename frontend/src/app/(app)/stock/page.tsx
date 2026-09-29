'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { InventorySnapshot, inventoryApi } from '@/lib/api/inventory';
import { organizationApi, Warehouse } from '@/lib/api/organization';
import { formatNumber, formatDateTime } from '@/lib/utils/cn';
import { MovementsPanel } from './_components/MovementsPanel';

export default function StockPage() {
  const qc = useQueryClient();
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<InventorySnapshot | null>(null);

  const warehousesQ = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => {
      const res = await organizationApi.listWarehouses();
      return res.items;
    },
  });

  // Auto-select first warehouse once loaded
  if (warehouseId === '' && warehousesQ.data && warehousesQ.data.length > 0) {
    setWarehouseId(warehousesQ.data[0].id);
  }

  const selectedWarehouse: Warehouse | undefined = warehousesQ.data?.find(
    (w) => w.id === warehouseId,
  );

  const snapshotsQ = useQuery({
    queryKey: ['stock-snapshots', warehouseId],
    queryFn: async () => {
      if (!warehouseId) return { items: [], total: 0, page: 1, limit: 50 };
      return inventoryApi.getSnapshots({ warehouseId, page: 1, limit: 100 });
    },
    enabled: !!warehouseId,
    refetchInterval: 10000, // 10s real-time refresh
  });

  const snapshots: InventorySnapshot[] = snapshotsQ.data?.items ?? [];
  const grouped = new Map<string, { snapshot: InventorySnapshot; onHand: number; reserved: number }>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.productId}:${snapshot.unitId}`;
    const current = grouped.get(key) ?? { snapshot, onHand: 0, reserved: 0 };
    if (snapshot.stockState === 'RESERVED') current.reserved += Number(snapshot.baseQuantity ?? snapshot.quantity);
    else if (snapshot.stockState === 'AVAILABLE') current.onHand += Number(snapshot.baseQuantity ?? snapshot.quantity);
    grouped.set(key, current);
  }
  const items = [...grouped.values()].filter(({ snapshot }) => {
    const s = snapshot;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.product?.name?.toLowerCase().includes(q) ||
      s.product?.skuCode?.toLowerCase().includes(q) ||
      s.batch?.batchCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            On hand, reserved, and available stock at the selected warehouse.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['stock-snapshots'] })}>
            Refresh
          </Button>
          <Button onClick={() => (window.location.href = '/stock/adjustments/new')}>
            + Adjustment
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <Select
                label="Warehouse"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">
                  {warehousesQ.isLoading ? 'Loading...' : 'Select warehouse'}
                </option>
                {(warehousesQ.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:max-w-sm">
              <Input
                label="Search"
                placeholder="SKU, name, batch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {snapshotsQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading snapshots...
            </div>
          ) : snapshotsQ.isError ? (
            <div className="px-4 py-8 text-sm text-red-600">
              Failed to load stock: {(snapshotsQ.error as Error).message}
            </div>
          ) : !warehouseId ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              Select a warehouse to view stock.
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              No stock at {selectedWarehouse?.name ?? 'this warehouse'}.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Product</TH>
                  <TH>Batch</TH>
                  <TH>Unit</TH>
                  <TH className="text-right">On Hand</TH>
                  <TH className="text-right">Reserved</TH>
                  <TH className="text-right">Available</TH>
                  <TH>State</TH>
                  <TH>Last Updated</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(({ snapshot: s, onHand, reserved }) => (
                  <TR
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <TD className="font-mono text-xs text-slate-700">{s.product?.skuCode ?? '—'}</TD>
                    <TD className="font-medium text-slate-900">{s.product?.name ?? '—'}</TD>
                    <TD className="font-mono text-xs">{s.batch?.batchCode ?? '—'}</TD>
                    <TD>
                      {s.unit?.symbol ?? '—'}
                    </TD>
                    <TD className="text-right tabular-nums">{formatNumber(onHand + reserved)}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{formatNumber(reserved)}</TD>
                    <TD className="text-right tabular-nums">{formatNumber(onHand)}</TD>
                    <TD>
                      <Badge variant={statusVariant(onHand < 10 ? (onHand <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK') : 'AVAILABLE')}>
                        {onHand <= 0 ? 'OUT OF STOCK' : onHand < 10 ? 'LOW STOCK' : 'AVAILABLE'}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-slate-500">{formatDateTime(s.updatedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MovementsPanel
        snapshot={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
