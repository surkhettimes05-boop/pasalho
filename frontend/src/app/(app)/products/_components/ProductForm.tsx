'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { catalogApi, Product, Category, Unit } from '@/lib/api/catalog';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/toaster';

type Props = {
  open: boolean;
  onClose: () => void;
};

type FormState = {
  skuCode: string;
  name: string;
  categoryId: string;
  defaultUnitId: string;
  barcode: string;
  costPrice: string;
  mrp: string;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
};

const empty: FormState = {
  skuCode: '',
  name: '',
  categoryId: '',
  defaultUnitId: '',
  barcode: '',
  costPrice: '',
  mrp: '',
  isBatchTracked: true,
  isExpiryTracked: true,
};

export function ProductForm({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(empty);
      setErrors({});
    }
  }, [open]);

  const categoriesQ = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => catalogApi.listCategories(),
    enabled: open,
  });
  const unitsQ = useQuery({
    queryKey: ['catalog-units'],
    queryFn: () => catalogApi.listUnits(),
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const body: any = {
        skuCode: form.skuCode.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId,
        defaultUnitId: form.defaultUnitId,
        isBatchTracked: form.isBatchTracked,
        isExpiryTracked: form.isExpiryTracked,
      };
      if (form.barcode.trim()) body.barcode = form.barcode.trim();
      if (form.costPrice.trim() !== '') body.costPrice = Number(form.costPrice);
      if (form.mrp.trim() !== '') body.mrp = Number(form.mrp);
      return (await api.post('/catalog/products', body)) as Product;
    },
    onSuccess: () => {
      toast({ title: 'Product created', variant: 'success' });
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'Failed to create product', description: e.message, variant: 'error' });
    },
  });

  const set = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.skuCode.trim()) e.skuCode = 'SKU is required';
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.categoryId) e.categoryId = 'Category is required';
    if (!form.defaultUnitId) e.defaultUnitId = 'Default unit is required';
    if (form.costPrice.trim() !== '' && Number.isNaN(Number(form.costPrice)))
      e.costPrice = 'Must be a number';
    if (form.mrp.trim() !== '' && Number.isNaN(Number(form.mrp))) e.mrp = 'Must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    createMut.mutate();
  };

  const onCreateClick = () => {
    const fake = { preventDefault: () => {} } as unknown as FormEvent;
    submit(fake);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Product"
      size="lg"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={createMut.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={onCreateClick} loading={createMut.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="SKU Code"
            value={form.skuCode}
            onChange={(e) => set('skuCode', e.target.value)}
            error={errors.skuCode}
            placeholder="e.g. SKU-0001"
            required
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="Product name"
            required
          />
          <Input
            label="Barcode"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            error={errors.barcode}
            placeholder="Optional"
          />
          <div />
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            error={errors.categoryId}
            required
          >
            <option value="">
              {categoriesQ.isLoading ? 'Loading...' : 'Select category'}
            </option>
            {(categoriesQ.data ?? []).map((c: Category) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Default Unit"
            value={form.defaultUnitId}
            onChange={(e) => set('defaultUnitId', e.target.value)}
            error={errors.defaultUnitId}
            required
          >
            <option value="">
              {unitsQ.isLoading ? 'Loading...' : 'Select unit'}
            </option>
            {(unitsQ.data ?? []).map((u: Unit) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.symbol})
              </option>
            ))}
          </Select>
          <Input
            label="Cost Price"
            type="number"
            step="0.01"
            min="0"
            value={form.costPrice}
            onChange={(e) => set('costPrice', e.target.value)}
            error={errors.costPrice}
            placeholder="0.00"
          />
          <Input
            label="MRP"
            type="number"
            step="0.01"
            min="0"
            value={form.mrp}
            onChange={(e) => set('mrp', e.target.value)}
            error={errors.mrp}
            placeholder="0.00"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isBatchTracked}
              onChange={(e) => set('isBatchTracked', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Batch tracked
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isExpiryTracked}
              onChange={(e) => set('isExpiryTracked', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Expiry tracked
          </label>
        </div>

        {categoriesQ.isError ? (
          <p className="text-xs text-red-600">
            Failed to load categories: {(categoriesQ.error as Error).message}
          </p>
        ) : null}
        {unitsQ.isError ? (
          <p className="text-xs text-red-600">
            Failed to load units: {(unitsQ.error as Error).message}
          </p>
        ) : null}
        {createMut.isError ? (
          <p className="text-xs text-red-600">
            Create failed: {(createMut.error as Error).message}
          </p>
        ) : null}
        {createMut.isPending ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Spinner size="sm" /> Saving...
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
