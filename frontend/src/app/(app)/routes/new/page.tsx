'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { routesApi } from '@/lib/api/routes';
import { organizationApi } from '@/lib/api/organization';
import { salesApi, Retailer } from '@/lib/api/sales';

interface Stop {
  retailerId: string;
  retailerName: string;
  stopOrder: number;
  notes: string;
}

export default function NewRoutePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stops, setStops] = useState<Stop[]>([]);
  const [retailerSearch, setRetailerSearch] = useState('');

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
    queryKey: ['retailers', retailerSearch],
    queryFn: () => salesApi.listRetailers({ search: retailerSearch, limit: 20 }),
    enabled: retailerSearch.length > 0,
  });
  const retailers: Retailer[] = retailersQ.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      routesApi.create({
        branchId,
        salesRepId,
        code,
        name,
        description: description || undefined,
        stops: stops.map((s) => ({ retailerId: s.retailerId, stopOrder: s.stopOrder, notes: s.notes || undefined })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      router.push(`/routes/${data.id}`);
    },
  });

  function addStop(retailer: Retailer) {
    if (stops.find((s) => s.retailerId === retailer.id)) return;
    setStops((prev) => [
      ...prev,
      { retailerId: retailer.id, retailerName: retailer.shopName, stopOrder: prev.length + 1, notes: '' },
    ]);
    setRetailerSearch('');
  }

  function removeStop(idx: number) {
    setStops((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stopOrder: i + 1 })));
  }

  function moveStop(idx: number, dir: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, stopOrder: i + 1 }));
    });
  }

  const canSubmit = branchId && salesRepId && code && name;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Route</h1>
        <p className="mt-1 text-sm text-slate-500">Create a delivery route and assign retailer stops</p>
      </div>

      {/* Basic Info */}
      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Route Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Branch</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Sales Rep</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={salesRepId}
              onChange={(e) => setSalesRepId(e.target.value)}
            >
              <option value="">Select sales rep</option>
              {salesReps.map((r: any) => (
                <option key={r.id} value={r.id}>{r.user?.fullName} ({r.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Route Code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. RT-001" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Route Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kathmandu North" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description (optional)</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
        </div>
      </div>

      {/* Retailer Stops */}
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Retailer Stops</h2>
        <div className="relative">
          <Input
            placeholder="Search retailers to add..."
            value={retailerSearch}
            onChange={(e) => setRetailerSearch(e.target.value)}
          />
          {retailerSearch && retailers.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {retailers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => addStop(r)}
                >
                  <span className="font-medium">{r.shopName}</span>
                  <span className="text-xs text-gray-400">{r.ownerName} · {r.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {stops.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-400">
            Search and add retailer stops above
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Retailer</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stops.map((s, i) => (
                  <tr key={s.retailerId}>
                    <td className="px-3 py-2 text-gray-500">{s.stopOrder}</td>
                    <td className="px-3 py-2 font-medium">{s.retailerName}</td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-7 w-40 text-xs"
                        placeholder="Notes"
                        value={s.notes}
                        onChange={(e) => setStops((prev) => prev.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-gray-100" onClick={() => moveStop(i, -1)} disabled={i === 0}>↑</button>
                        <button type="button" className="rounded border px-2 py-0.5 text-xs hover:bg-gray-100" onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1}>↓</button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeStop(i)}>Remove</button>
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
          {createMutation.isPending ? 'Creating...' : 'Create Route'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
      )}
    </div>
  );
}
