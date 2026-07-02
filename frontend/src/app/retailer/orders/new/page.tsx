'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, ShoppingCart, Plus, Minus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { formatCurrency } from '@/lib/utils/cn';
import { retailerApi, retailerOrderApi, RetailerProduct } from '@/lib/api/retailer-portal';

interface CartItem {
  productId: string;
  productName: string;
  skuCode: string;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  batchId?: string;
  quantity: number;
  unitPrice: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['retailer-products', debouncedSearch],
    queryFn: () => retailerApi.get(`/catalog/products?search=${encodeURIComponent(debouncedSearch)}&limit=20`),
    enabled: debouncedSearch.length > 0,
  });

  const products: RetailerProduct[] = Array.isArray(productsData) ? productsData : (productsData as any)?.items ?? [];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const addToCart = (product: RetailerProduct) => {
    const unit = product.units?.[0] ?? product.defaultUnit;
    if (!unit) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id && c.unitId === unit.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id && c.unitId === unit.id
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          skuCode: product.skuCode,
          unitId: unit.id,
          unitName: unit.name,
          unitSymbol: unit.symbol,
          quantity: 1,
          unitPrice: 0,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, unitId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.productId === productId && c.unitId === unitId
            ? { ...c, quantity: Math.max(1, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  const removeFromCart = (productId: string, unitId: string) => {
    setCart((prev) => prev.filter((c) => !(c.productId === productId && c.unitId === unitId)));
  };

  const updateUnitPrice = (productId: string, unitId: string, price: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.productId === productId && c.unitId === unitId ? { ...c, unitPrice: price } : c,
      ),
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      retailerOrderApi.create({
        items: cart.map((c) => ({
          productId: c.productId,
          unitId: c.unitId,
          batchId: c.batchId,
          quantity: c.quantity,
        })),
        notes: notes || undefined,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['retailer-orders'] });
      router.push(`/retailer/orders/${order.id}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/retailer/orders" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Order</h1>
          <p className="text-sm text-gray-500">Search and add products to your order</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search products by name or SKU..."
          className="pl-9"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {debouncedSearch && (
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <Spinner />
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-500">No products found</p>
            ) : (
              <div className="divide-y">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.skuCode}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addToCart(product)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
              <div key={`${item.productId}-${item.unitId}`} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.skuCode}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.productId, item.unitId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.unitId, -1)}
                      className="rounded border p-0.5 text-gray-500 hover:bg-gray-200"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.unitId, 1)}
                      className="rounded border p-0.5 text-gray-500 hover:bg-gray-200"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-500">{item.unitSymbol}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-xs text-gray-400">Price:</span>
                    <input
                      type="number"
                      className="w-20 rounded border border-gray-300 px-2 py-0.5 text-right text-sm"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateUnitPrice(item.productId, item.unitId, Number(e.target.value) || 0)}
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
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Order Notes</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this order..."
            />
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={cart.length === 0}
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

      {cart.length === 0 && !debouncedSearch && (
        <div className="py-12 text-center text-sm text-gray-500">
          Search for products above to add them to your order.
        </div>
      )}
    </div>
  );
}
