'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Modal } from '../_components/Modal';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { catalogApi, Product } from '@/lib/api/catalog';
import { organizationApi, Warehouse } from '@/lib/api/organization';
import { salesApi, Invoice, InvoiceItemInput, Retailer } from '@/lib/api/sales';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/toaster';
import { formatCurrency } from '@/lib/utils/cn';

type LineItem = InvoiceItemInput & {
  productName: string;
  productSku: string;
  unitSymbol: string;
  isBatchTracked: boolean;
};

const EMPTY_ITEM: Omit<LineItem, 'productName' | 'productSku' | 'unitSymbol' | 'isBatchTracked'> = {
  productId: '',
  unitId: '',
  quantity: 1,
  baseQuantity: 1,
  unitPrice: 0,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [warehouseId, setWarehouseId] = useState('');
  const [retailerId, setRetailerId] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const warehousesQ = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: async () => (await organizationApi.listWarehouses()).items,
  });

  const retailersQ = useQuery({
    queryKey: ['retailers-all'],
    queryFn: async () => (await salesApi.listRetailers()).items,
  });

  const productsQ = useQuery({
    queryKey: ['pos-products', debouncedProductSearch],
    queryFn: () =>
      catalogApi.listProducts({
        search: debouncedProductSearch || undefined,
        limit: 12,
      }),
  });

  const selectedWarehouse: Warehouse | undefined = warehousesQ.data?.find((w) => w.id === warehouseId);

  const addProduct = (p: Product) => {
    if (!p.defaultUnitId) {
      toast({ title: 'Product has no default unit', variant: 'error' });
      return;
    }
    const mrp = p.mrp !== undefined && p.mrp !== null ? Number(p.mrp) : 0;
    const newItem: LineItem = {
      ...EMPTY_ITEM,
      productId: p.id,
      unitId: p.defaultUnitId,
      unitPrice: mrp,
      productName: p.name,
      productSku: p.skuCode,
      unitSymbol: p.defaultUnit?.symbol ?? '',
      isBatchTracked: p.isBatchTracked,
    };
    setItems((prev) => [...prev, newItem]);
    setProductSearch('');
  };

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0),
    [items],
  );
  const taxEstimate = useMemo(() => subtotal * 0.13, [subtotal]);
  const grandTotal = useMemo(() => subtotal + taxEstimate, [subtotal, taxEstimate]);

  const branchId = selectedWarehouse?.branchId;
  const canSave = items.length > 0 && !!warehouseId && !!branchId;

  const buildPayload = (): any | null => {
    if (!selectedWarehouse) return null;
    // Backend may need sourceLocationId; if not present on warehouse, fall back to warehouseId.
    return {
      branchId: selectedWarehouse.branchId,
      warehouseId: selectedWarehouse.id,
      sourceLocationId: (selectedWarehouse as any).inventoryLocation?.id ?? selectedWarehouse.id,
      retailerId: retailerId || undefined,
      items: items.map((it) => ({
        productId: it.productId,
        batchId: it.batchId,
        unitId: it.unitId,
        quantity: Number(it.quantity),
        baseQuantity: Number(it.baseQuantity || it.quantity),
        unitPrice: Number(it.unitPrice),
        discountAmount: it.discountAmount ? Number(it.discountAmount) : 0,
        taxAmount: it.taxAmount ? Number(it.taxAmount) : 0,
      })),
    };
  };

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      const body = buildPayload();
      if (!body) throw new Error('No warehouse selected');
      return salesApi.createInvoice(body);
    },
    onSuccess: (inv) => {
      toast({ title: `Invoice ${inv.invoiceNumber} saved`, variant: 'success' });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      router.push(`/invoices/${inv.id}`);
    },
    onError: (e: Error) =>
      toast({ title: 'Save failed', description: e.message, variant: 'error' }),
  });

  const postMut = useMutation({
    mutationFn: async () => {
      const body = buildPayload();
      if (!body) throw new Error('No warehouse selected');
      const inv = await salesApi.createInvoice(body);
      return salesApi.postInvoice(inv.id);
    },
    onSuccess: (inv) => {
      toast({ title: `Invoice ${inv.invoiceNumber} posted`, variant: 'success' });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      router.push(`/invoices/${inv.id}`);
    },
    onError: (e: Error) =>
      toast({ title: 'Post failed', description: e.message, variant: 'error' }),
  });

  const saveAndPayMut = useMutation({
    mutationFn: async () => {
      const body = buildPayload();
      if (!body) throw new Error('No warehouse selected');
      const inv = await salesApi.createInvoice(body);
      const posted = await salesApi.postInvoice(inv.id);
      const total = Number(posted.grandTotal) || 0;
      if (total > 0) {
        await api.post('/sales/payments', {
          invoiceId: posted.id,
          amount: total,
          paymentMethod: 'CASH',
        });
      }
      return posted;
    },
    onSuccess: (inv) => {
      toast({ title: `Invoice ${inv.invoiceNumber} saved & paid`, variant: 'success' });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      router.push(`/invoices/${inv.id}`);
    },
    onError: (e: Error) =>
      toast({ title: 'Save+Pay failed', description: e.message, variant: 'error' }),
  });

  const busy = saveDraftMut.isPending || postMut.isPending || saveAndPayMut.isPending;

  const onScanned = async (code: string) => {
    setScanOpen(false);
    setProductSearch(code);
    setDebouncedProductSearch(code);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Invoice (POS)</h1>
          <p className="mt-1 text-sm text-slate-500">Add products, choose retailer, save &amp; post.</p>
        </div>
        <Link href="/invoices">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: product search + add */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Add product</h2>
                <Button size="sm" variant="outline" type="button" onClick={() => setScanOpen(true)}>
                  Scan Barcode
                </Button>
              </div>
              <Input
                placeholder="Search by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productsQ.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Spinner size="sm" /> Searching...
                </div>
              ) : productsQ.data && productsQ.data.items.length > 0 ? (
                <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
                  {productsQ.data.items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-0"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-900">{p.name}</span>
                        <span className="text-xs text-slate-500">{formatCurrency(p.mrp)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="font-mono">{p.skuCode}</span>
                        {p.barcode ? <span className="ml-2">· {p.barcode}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : productSearch ? (
                <p className="text-xs text-slate-500">No products match.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Center: cart */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  Cart is empty. Search and add products on the left.
                </div>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Product</TH>
                      <TH className="text-right">Qty</TH>
                      <TH className="text-right">Unit Price</TH>
                      <TH className="text-right">Line Total</TH>
                      <TH />
                    </TR>
                  </THead>
                  <TBody>
                    {items.map((it, idx) => (
                      <TR key={idx}>
                        <TD>
                          <div className="font-medium text-slate-900">{it.productName}</div>
                          <div className="font-mono text-xs text-slate-500">
                            {it.productSku} · {it.unitSymbol}
                          </div>
                        </TD>
                        <TD className="text-right">
                          <Input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={it.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                            className="ml-auto w-24 text-right"
                          />
                        </TD>
                        <TD className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.unitPrice}
                            onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                            className="ml-auto w-28 text-right"
                          />
                        </TD>
                        <TD className="text-right tabular-nums font-semibold">
                          {formatCurrency(Number(it.quantity) * Number(it.unitPrice))}
                        </TD>
                        <TD className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => removeItem(idx)}
                          >
                            ×
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  label="Warehouse"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="">
                    {warehousesQ.isLoading ? 'Loading...' : 'Select warehouse'}
                  </option>
                  {(warehousesQ.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </Select>

                <Select
                  label="Retailer (optional for cash walk-in)"
                  value={retailerId}
                  onChange={(e) => setRetailerId(e.target.value)}
                >
                  <option value="">— Cash / walk-in —</option>
                  {(retailersQ.data ?? []).map((r: Retailer) => (
                    <option key={r.id} value={r.id}>
                      {r.shopName} {r.ownerName ? `(${r.ownerName})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax (est. 13%)</span>
                  <span className="tabular-nums">{formatCurrency(taxEstimate)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                  <span>Grand total</span>
                  <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  type="button"
                  disabled={!canSave || busy}
                  onClick={() => saveDraftMut.mutate()}
                >
                  {saveDraftMut.isPending ? <Spinner size="sm" /> : null} Save Draft
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!canSave || busy}
                  onClick={() => postMut.mutate()}
                >
                  {postMut.isPending ? <Spinner size="sm" /> : null} Save &amp; Post
                </Button>
                <Button
                  type="button"
                  disabled={!canSave || busy}
                  onClick={() => saveAndPayMut.mutate()}
                >
                  {saveAndPayMut.isPending ? <Spinner size="sm" /> : null} Save &amp; Pay (Cash)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan barcode" size="md">
        <BarcodeScanner onScan={onScanned} onClose={() => setScanOpen(false)} />
      </Modal>
    </div>
  );
}
