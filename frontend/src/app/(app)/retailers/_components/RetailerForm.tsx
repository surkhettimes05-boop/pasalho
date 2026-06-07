'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api/client';
import { organizationApi } from '@/lib/api/organization';
import { toast } from '@/components/ui/toaster';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RetailerForm({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    branchId: '',
    shopName: '',
    ownerName: '',
    phone: '',
    address: '',
    creditLimit: '0',
    code: '',
  });

  const branchesQ = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => organizationApi.listBranches(),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.post('/retailers', {
        ...form,
        creditLimit: Number(form.creditLimit),
      }),
    onSuccess: () => {
      toast({ title: 'Retailer created', variant: 'success' });
      setForm({ branchId: '', shopName: '', ownerName: '', phone: '', address: '', creditLimit: '0', code: '' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'error' }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Retailer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <Select
            label="Branch"
            value={form.branchId}
            onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
            required
          >
            <option value="">Select branch</option>
            {(branchesQ.data?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="RET-004" required />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
          </div>
          <Input label="Shop Name" value={form.shopName} onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))} required />
          <Input label="Owner Name" value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} required />
          <Input label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Input label="Credit Limit (NPR)" type="number" min="0" value={form.creditLimit} onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.branchId || !form.shopName || !form.code || !form.phone}
          >
            {createMut.isPending ? <Spinner size="sm" /> : null} Create
          </Button>
        </div>
      </div>
    </div>
  );
}
