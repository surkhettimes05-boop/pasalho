'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { formatCurrency } from '@/lib/utils/cn';
import {
  retailerRecommendationApi,
  retailerOrderApi,
  ReorderSuggestion,
} from '@/lib/api/retailer-portal';

interface QuickCartItem {
  productId: string;
  productName: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  unitId?: string;
}

export default function QuickReorderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<QuickCartItem[]>([]);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['retailer-quick-reorder'],
    queryFn: () => retailerRecommendationApi.getQuickReorder(),
  });

  const items: ReorderSuggestion[] = suggestions ?? [];

  const isInCart = (productId: string) => cart.some((c) => c.productId === productId);

  const toggleCart = (item: ReorderSuggestion) => {
    if (isInCart(item.productId)) {
      setCart((prev) => prev.filter((c) => c.productId !== item.productId));
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: item.productId,
          productName: item.productName,
          skuCode: item.skuCode,
          quantity: 1,
          unitPrice: 0,
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: Math.max(1, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const updatePrice = (productId: string, price: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId ? { ...c, unitPrice: price } : c,
      ),
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      retailerOrderApi.create({
        items: cart.map((c) => ({
          productId: c.productId,
          unitId: c.unitId || 'placeholder',
          quantity: c.quantity,
        })),
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['retailer-orders'] });
      router.push(`/retailer/orders/${order.id}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/retailer/dashboard" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quick Reorder</h1>
          <p className="text-sm text-gray-500">Frequently ordered products</p>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">
          No reorder suggestions yet. Place some orders to get recommendations.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                <p className="text-xs text-gray-500">
                  {item.skuCode} &middot; Ordered {item.orderCount} times
                </p>
              </div>
              <Button
                variant={isInCart(item.productId) ? 'primary' : 'outline'}
                size="sm"
                onClick={() => toggleCart(item)}
              >
                {isInCart(item.productId) ? 'Added' : 'Add'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                <ShoppingCart className="mr-1 inline h-4 w-4" />
                Cart ({cart.length})
              </CardTitle>
              <span className="text-sm font-semibold">{formatCurrency(cartTotal)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.map((item) => (
              <div key={item.productId} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.skuCode}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="rounded border p-0.5 text-gray-500 hover:bg-gray-200"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="rounded border p-0.5 text-gray-500 hover:bg-gray-200"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-xs text-gray-400">Price:</span>
                    <input
                      type="number"
                      className="w-20 rounded border border-gray-300 px-2 py-0.5 text-right text-sm"
                      value={item.unitPrice || ''}
                      onChange={(e) => updatePrice(item.productId, Number(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="mt-1 text-right text-xs text-gray-500">
                  Line total: {formatCurrency(item.quantity * item.unitPrice)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cart.length > 0 && (
        <div className="space-y-3 pb-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
          >
            Submit Order &mdash; {formatCurrency(cartTotal)}
          </Button>
          {createMutation.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {(createMutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
