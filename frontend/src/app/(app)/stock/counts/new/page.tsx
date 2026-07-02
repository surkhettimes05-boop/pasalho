'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { stockCountApi } from '@/lib/api/phase4';
import { organizationApi } from '@/lib/api/organization';

export default function NewStockCountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');

  const branchesQ = useQuery({ queryKey: ['branches'], queryFn: () => organizationApi.listBranches() });
  const branches = branchesQ.data?.items ?? [];

  const warehousesQ = useQuery({
    queryKey: ['warehouses', branchId],
    queryFn: () => organizationApi.listWarehouses(branchId),
    enabled: !!branchId,
  });
  const warehouses = warehousesQ.data?.items ?? [];

  const startMutation = useMutation({
    mutationFn: () => stockCountApi.start({ branchId, warehouseId, locationId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      router.push(`/stock/counts/${data.id}`);
    },
  });

  const canSubmit = branchId && warehouseId && locationId;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Start Physical Stock Count</h1>
        <p className="mt-1 text-sm text-slate-500">
          Creates a count session pre-filled with current system quantities. Enter actual physical counts to find variances.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Branch</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setWarehouseId(''); setLocationId(''); }}
          >
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Warehouse</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              const wh = warehouses.find((w) => w.id === e.target.value);
              setLocationId(wh?.inventoryLocation?.id ?? '');
            }}
            disabled={!branchId}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {locationId && (
          <p className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Inventory location auto-selected: <span className="font-mono">{locationId.slice(0, 8)}…</span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        This will snapshot current system quantities. Any stock movements after this point will not affect the count session.
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => startMutation.mutate()}
          disabled={!canSubmit || startMutation.isPending}
        >
          {startMutation.isPending ? 'Starting...' : 'Start Count Session'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>

      {startMutation.isError && (
        <p className="text-sm text-red-600">{(startMutation.error as Error).message}</p>
      )}
    </div>
  );
}
