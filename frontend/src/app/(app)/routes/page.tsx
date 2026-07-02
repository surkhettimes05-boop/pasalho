'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { routesApi, Route } from '@/lib/api/routes';
import { formatDate } from '@/lib/utils/cn';

export default function RoutesPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: () => routesApi.list({ limit: 100 }),
  });

  const items: Route[] = (data?.items ?? []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.salesRep?.user?.fullName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Routes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sales rep delivery routes and retailer stops
          </p>
        </div>
        <Link href="/routes/new">
          <Button>+ New Route</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search routes..."
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No routes found. Create a route to assign retailers to a sales rep.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sales Rep</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.salesRep?.user?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.branch?.name ?? '—'}</td>
                  <td className="px-4 py-3">{r._count?.stops ?? r.stops?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusVariant(r.status)}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/routes/${r.id}`} className="text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
