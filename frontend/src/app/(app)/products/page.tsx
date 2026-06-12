'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { catalogApi, Product } from '@/lib/api/catalog';
import { formatCurrency } from '@/lib/utils/cn';
import { ProductForm } from './_components/ProductForm';
import { BatchesDialog } from './_components/BatchesDialog';

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [batchesFor, setBatchesFor] = useState<Product | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const productsQ = useQuery({
    queryKey: ['products', { search: debouncedSearch, page, limit: PAGE_SIZE }],
    queryFn: () =>
      catalogApi.listProducts({
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const total = productsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items: Product[] = productsQ.data?.items ?? [];

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your product catalog and batches</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Product</Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-sm">
              <Input
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-slate-500">
              {productsQ.isLoading ? 'Loading...' : `${total} product${total === 1 ? '' : 's'}`}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {productsQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading products...
            </div>
          ) : productsQ.isError ? (
            <div className="px-4 py-8 text-sm text-red-600">
              Failed to load products: {(productsQ.error as Error).message}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              No products found. Click "New Product" to create one.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Name</TH>
                  <TH>Category</TH>
                  <TH className="text-right">MRP</TH>
                  <TH>Default Unit</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs text-slate-700">{p.skuCode}</TD>
                    <TD className="font-medium text-slate-900">{p.name}</TD>
                    <TD>{p.category?.name ?? '—'}</TD>
                    <TD className="text-right">{formatCurrency(p.mrp)}</TD>
                    <TD>
                      {p.defaultUnit ? (
                        <>
                          {p.defaultUnit.name}{' '}
                          <span className="text-xs text-slate-500">({p.defaultUnit.symbol})</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TD>
                    <TD>
                      <Badge variant={statusVariant(p.isActive !== false ? 'ACTIVE' : 'INACTIVE')}>
                        {p.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBatchesFor(p)}
                      >
                        View Batches
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || productsQ.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            {pageNumbers.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={n === page ? 'primary' : 'outline'}
                disabled={productsQ.isFetching}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || productsQ.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ProductForm open={createOpen} onClose={() => setCreateOpen(false)} />
      <BatchesDialog
        open={batchesFor !== null}
        onClose={() => setBatchesFor(null)}
        product={batchesFor}
      />
    </div>
  );
}
