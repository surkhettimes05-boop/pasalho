'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { dashboardApi } from '@/lib/api/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

export default function DashboardPage() {
  const { user } = useAuthStore();

  // dashboard endpoint may not exist yet — guard with try/catch via the API
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.fullName ?? '—'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {user?.defaultBranch?.name ?? 'No branch assigned'} •{' '}
          {user?.userRoles?.[0]?.roleName ?? 'No role'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="h-4 w-4" /> Loading dashboard…
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-6 text-sm text-gray-500">
            Dashboard data not available. Use the sidebar to navigate.
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard title="Today's Sales" value={data.todaySales ?? '—'} />
          <KpiCard title="Pending Invoices" value={data.pendingInvoices ?? '—'} />
          <KpiCard title="Low Stock Items" value={data.lowStockItems ?? '—'} />
          <KpiCard title="Active Retailers" value={data.activeRetailers ?? '—'} />
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  );
}
