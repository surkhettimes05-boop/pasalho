'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Bell, DollarSign, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { formatCurrency, formatNumber } from '@/lib/utils/cn';
import { useRetailerAuth } from '../layout';
import { retailerOrderApi, retailerNotificationApi, retailerRecommendationApi, ReorderSuggestion } from '@/lib/api/retailer-portal';

export default function RetailerDashboardPage() {
  const router = useRouter();
  const { profile } = useRetailerAuth();

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['retailer-orders'],
    queryFn: () => retailerOrderApi.list({ limit: 1 }),
  });

  const { data: unreadData, isLoading: notifLoading } = useQuery({
    queryKey: ['retailer-notifications-unread'],
    queryFn: () => retailerNotificationApi.getUnreadCount(),
  });

  const { data: quickReorder, isLoading: reorderLoading } = useQuery({
    queryKey: ['retailer-quick-reorder'],
    queryFn: () => retailerRecommendationApi.getQuickReorder(),
  });

  const recentOrdersCount = ordersData?.total ?? 0;
  const unreadCount = unreadData?.count ?? 0;

  const outstanding = profile?.outstanding ?? 0;
  const creditLimit = profile?.creditLimit ?? 0;
  const creditUsed = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Welcome, {profile?.shopName ?? 'Retailer'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your orders and account</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-gray-500">Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(outstanding)}</p>
            <p className="mt-1 text-xs text-gray-500">
              of {formatCurrency(creditLimit)} credit limit ({creditUsed}% used)
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(creditUsed, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-gray-500">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(recentOrdersCount)}</p>
                <p className="mt-1 text-xs text-gray-500">total orders placed</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-gray-500">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {notifLoading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(unreadCount)}</p>
                <p className="mt-1 text-xs text-gray-500">unread notifications</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-gray-500">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/retailer/orders/new">
              <Button className="w-full" size="sm">
                <PlusCircle className="mr-1 h-4 w-4" />
                Place New Order
              </Button>
            </Link>
            <Link href="/retailer/quick-reorder">
              <Button variant="outline" className="w-full" size="sm">
                Quick Reorder
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Reorder</CardTitle>
        </CardHeader>
        <CardContent>
          {reorderLoading ? (
            <Spinner />
          ) : !quickReorder || quickReorder.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              No reorder suggestions yet. Place some orders to get recommendations.
            </p>
          ) : (
            <div className="divide-y">
              {quickReorder.slice(0, 5).map((item: ReorderSuggestion) => (
                <div key={item.productId} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">
                      Ordered {item.orderCount} times
                    </p>
                  </div>
                  <Link href={`/retailer/orders/new?productId=${item.productId}`}>
                    <Button variant="outline" size="sm">Reorder</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 pb-4">
        <Link href="/retailer/orders" className="text-sm text-blue-600 hover:underline">View Orders</Link>
        <Link href="/retailer/invoices" className="text-sm text-blue-600 hover:underline">View Invoices</Link>
        <Link href="/retailer/payments" className="text-sm text-blue-600 hover:underline">View Payments</Link>
      </div>
    </div>
  );
}
