'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deliveriesApi } from '@/lib/api/deliveries';
import { organizationApi } from '@/lib/api/organization';
import { salesApi } from '@/lib/api/sales';

export default function NewDeliveryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [branchId, setBranchId] = useState('');
  const [routeId, setRouteId] = useState(searchParams.get('routeId') ?? '');
  const [vehicleRef, setVehicleRef] = useState('');
  const [driverName, setDriverName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedRetailers, setSelectedRetailers] = useState<{ retailerId: string; shopName: string; invoiceId: string }[]>([]);
  const [retailerSearch, setRetailerSearch] = useState('');

  const branchesQ = useQuery({ queryKey: ['branches'], queryFn: () => organizationApi.listBranches() });
  const branches = branchesQ.data?.items ?? [];

  const routesQ = useQuery({
    queryKey: ['routes-dropdown', branchId],
    queryFn: () => fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/routes?branchId=${branchId}&limit=100`, {
      headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('pasalo_token') : ''}` },
    }).then(r => r.json()).then(r => r.data),
    enabled: !!branchId,
  });
  const routes = routesQ.data?.items ?? [];

  const retailersQ = useQuery({
    queryKey: ['retailers-search', retailerSearch],
    queryFn: () => salesApi.listRetailers({ search: retailerSearch, limit: 20 }),
    enabled: retailerSearch.length > 0,
  });
  const retailers = retailersQ.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      deliveriesApi.create({
        branchId,
        routeId: routeId || undefined,
        vehicleRef: vehicleRef || undefined,
        driverName: driverName || undefined,
        scheduledAt: scheduledAt || undefined,
        notes: notes || undefined,
        items: selectedRetailers.map((r) => ({
          retailerId: r.retailerId,
          invoiceId: r.invoiceId || undefined,
        })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      router.push(`/deliveries/${data.id}`);
    },
  });

  function addRetailer(r: any) {
    if (selectedRetailers.find((x) => x.retailerId === r.id)) return;
    setSelectedRetailers((prev) => [...prev, { retailerId: r.id, shopName: r.shopName, invoiceId: '' }]);
    setRetailerSearch('');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Delivery</h1>
        <p className="mt-1 text-sm text-slate-500">Schedule a vehicle dispatch for retailer deliveries</p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Delivery Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Branch</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={branchId}
              onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Route (optional)</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={routeId}
              onChange={(e) => setRouteId(e.target.value)} disabled={!branchId}>
              <option value="">No route</option>
              {routes.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Driver Name</label>
            <Input placeholder="Driver's full name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Vehicle Ref</label>
            <Input placeholder="Plate / vehicle ID" value={vehicleRef} onChange={(e) => setVehicleRef(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Scheduled Date</label>
            <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <Input placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Retailer stops */}
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Retailers to Deliver To</h2>
        <div className="relative">
          <Input placeholder="Search retailers..." value={retailerSearch} onChange={(e) => setRetailerSearch(e.target.value)} />
          {retailerSearch && retailers.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {retailers.map((r) => (
                <button key={r.id} type="button"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => addRetailer(r)}>
                  <span className="font-medium">{r.shopName}</span>
                  <span className="text-xs text-gray-400">{r.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedRetailers.length === 0 ? (
          <p className="text-sm text-gray-400">Add retailers above to include in this delivery run.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {selectedRetailers.map((r, i) => (
              <div key={r.retailerId} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium">{r.shopName}</span>
                <Input className="w-48 text-xs" placeholder="Invoice ID (optional)"
                  value={r.invoiceId}
                  onChange={(e) => setSelectedRetailers((prev) => prev.map((x, j) => j === i ? { ...x, invoiceId: e.target.value } : x))} />
                <button type="button" className="text-xs text-red-600 hover:underline"
                  onClick={() => setSelectedRetailers((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => createMutation.mutate()} disabled={!branchId || createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Delivery'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
      {createMutation.isError && (
        <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
      )}
    </div>
  );
}
