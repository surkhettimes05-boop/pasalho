'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { routesApi } from '@/lib/api/routes';
import { formatDate } from '@/lib/utils/cn';

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: route, isLoading } = useQuery({
    queryKey: ['route', id],
    queryFn: () => routesApi.findById(id),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => routesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['route', id] });
    },
  });

  if (isLoading) return <Spinner />;
  if (!route) return <div className="py-12 text-center text-gray-500">Route not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{route.name}</h1>
            <Badge className={statusVariant(route.status)}>{route.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Code: <span className="font-mono">{route.code}</span> · Created {formatDate(route.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/routes')}>Back</Button>
          {route.status === 'ACTIVE' && (
            <Button
              variant="outline"
              onClick={() => { if (confirm('Deactivate this route?')) deactivateMutation.mutate(); }}
              disabled={deactivateMutation.isPending}
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sales Rep</p>
          <p className="mt-1 font-semibold">{route.salesRep?.user?.fullName ?? '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
          <p className="mt-1 font-semibold">{route.branch?.name ?? '—'}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Stops</p>
          <p className="mt-1 text-2xl font-bold">{route.stops?.length ?? 0}</p>
        </div>
      </div>

      {/* Description */}
      {route.description && (
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</p>
          <p className="mt-1 text-sm">{route.description}</p>
        </div>
      )}

      {/* Stops */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Retailer Stops</h2>
        {route.stops?.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-gray-400">
            No stops assigned to this route.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {route.stops
                  ?.sort((a, b) => a.stopOrder - b.stopOrder)
                  .map((stop) => (
                    <tr key={stop.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{stop.stopOrder}</td>
                      <td className="px-4 py-3 font-medium">{stop.retailer?.shopName}</td>
                      <td className="px-4 py-3">{stop.retailer?.ownerName}</td>
                      <td className="px-4 py-3 text-gray-500">{stop.retailer?.phone}</td>
                      <td className="px-4 py-3 text-gray-400">{stop.notes ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {route.status === 'ACTIVE' && (
        <div className="flex gap-3 border-t pt-4">
          <Button onClick={() => router.push(`/orders/new?routeId=${route.id}`)}>
            + Create Order for this Route
          </Button>
          <Button variant="outline" onClick={() => router.push(`/deliveries/new?routeId=${route.id}`)}>
            + Schedule Delivery
          </Button>
        </div>
      )}
    </div>
  );
}
