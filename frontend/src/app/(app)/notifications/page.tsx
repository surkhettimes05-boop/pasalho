'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { notificationsApi, Notification, NotificationType } from '@/lib/api/notifications';
import { formatDateTime } from '@/lib/utils/cn';
import { cn } from '@/lib/utils/cn';

const TYPE_ICONS: Record<NotificationType, string> = {
  LOW_STOCK: '⚠️',
  OUT_OF_STOCK: '🚫',
  ORDER_CONFIRMED: '✅',
  DELIVERY_UPDATE: '🚚',
  SYSTEM: 'ℹ️',
};

const TYPE_COLORS: Record<NotificationType, string> = {
  LOW_STOCK: 'bg-amber-50 border-amber-200',
  OUT_OF_STOCK: 'bg-red-50 border-red-200',
  ORDER_CONFIRMED: 'bg-green-50 border-green-200',
  DELIVERY_UPDATE: 'bg-blue-50 border-blue-200',
  SYSTEM: 'bg-gray-50 border-gray-200',
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => notificationsApi.list({ status: filter === 'UNREAD' ? 'UNREAD' : undefined, limit: 100 }),
  });

  const notifications = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const generateMutation = useMutation({
    mutationFn: () => notificationsApi.generateLowStockAlerts(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      alert(`Generated ${data.created} new alert(s).`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">Stock alerts, order updates, and system messages</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
              Mark All Read
            </Button>
          )}
          <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Scanning...' : 'Scan Low Stock'}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        {(['ALL', 'UNREAD'] as const).map((f) => (
          <button
            key={f}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              filter === f
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl">🔔</p>
          <p className="mt-3 text-sm text-gray-500">
            {filter === 'UNREAD' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Click "Scan Low Stock" to generate alerts for low inventory.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-4 rounded-lg border p-4 transition-all',
                TYPE_COLORS[n.type] ?? 'bg-gray-50',
                n.status === 'UNREAD' ? 'shadow-sm' : 'opacity-70',
              )}
            >
              <span className="mt-0.5 text-xl">{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{n.title}</p>
                  {n.status === 'UNREAD' && (
                    <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-600">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
              </div>
              {n.status === 'UNREAD' && (
                <button
                  className="flex-shrink-0 text-xs text-blue-600 hover:underline"
                  onClick={() => markReadMutation.mutate(n.id)}
                  disabled={markReadMutation.isPending}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
