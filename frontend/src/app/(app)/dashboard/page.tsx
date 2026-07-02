'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { dashboardApi, DashboardSummary } from '@/lib/api/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { formatCurrency } from '@/lib/utils/cn';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const branchId = user?.defaultBranchId;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', branchId],
    queryFn: () => dashboardApi.get(branchId),
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
        <DashboardContent data={data} />
      ) : null}
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const today = data.today;
  const outstanding = data.outstanding;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's Sales"
          value={formatCurrency(today.invoiceSalesTotal)}
          subtitle={`${today.invoiceCount} invoices`}
        />
        <KpiCard
          title="Today's Payments"
          value={formatCurrency(today.paymentsTotal)}
          subtitle={`${today.paymentCount} payments`}
        />
        <KpiCard
          title="Outstanding Credit"
          value={formatCurrency(outstanding.totalRetailerCredit)}
          subtitle="Retailer balance"
        />
        <KpiCard
          title="Low Stock Items"
          value={String(data.lowStockCount)}
          subtitle="Below 10 units"
          variant={data.lowStockCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length === 0 ? (
              <p className="text-sm text-gray-400">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {data.recentInvoices.slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{inv.invoiceNumber}</span>
                      <span className="ml-2 text-gray-500">{inv.retailer?.shopName ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{formatCurrency(inv.grandTotal)}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Stock Movements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Recent Stock Movements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentMovements.length === 0 ? (
              <p className="text-sm text-gray-400">No movements yet</p>
            ) : (
              <div className="space-y-3">
                {data.recentMovements.slice(0, 5).map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{mov.product?.name ?? '—'}</span>
                      <span className="ml-2 text-gray-500">{mov.location?.name ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={mov.quantity >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {mov.quantity >= 0 ? '+' : ''}{mov.quantity}
                      </span>
                      <Badge variant="purple" className="text-xs">
                        {mov.movementType}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  variant = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variant === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
          {value}
        </div>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

const statusMap: Record<string, 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'> = {
  DRAFT: 'yellow',
  POSTED: 'green',
  PAID: 'green',
  PARTIALLY_PAID: 'blue',
  CREDIT_OPEN: 'blue',
  VOIDED: 'red',
  CANCELLED: 'red',
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusMap[status] ?? 'gray'}>{status}</Badge>;
}
