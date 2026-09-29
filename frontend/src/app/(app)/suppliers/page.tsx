'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { procurementApi } from '@/lib/api/procurement';

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ supplierCode: '', name: '', contactPerson: '', phone: '', email: '', address: '', taxIdentifier: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => procurementApi.listSuppliers() });
  const save = useMutation({ mutationFn: () => { const { supplierCode, ...editable } = form; const values = editingId ? editable : form; const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')); return editingId ? procurementApi.updateSupplier(editingId, payload) : procurementApi.createSupplier(payload); }, onSuccess: () => { setEditingId(null); setForm({ supplierCode: '', name: '', contactPerson: '', phone: '', email: '', address: '', taxIdentifier: '' }); qc.invalidateQueries({ queryKey: ['suppliers'] }); } });
  const deactivate = useMutation({ mutationFn: procurementApi.deactivateSupplier, onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }) });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-bold">Suppliers</h1><p className="mt-1 text-sm text-slate-500">Supplier records used on purchase orders.</p></header>
    <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {!editingId && <Input required placeholder="Supplier code" value={form.supplierCode} onChange={(e) => set('supplierCode', e.target.value)} />}
      <Input required placeholder="Supplier name" value={form.name} onChange={(e) => set('name', e.target.value)} />
      <Input placeholder="Contact person" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
      <Input placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      <Input type="email" placeholder="Email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      <Input placeholder="PAN / tax identifier" value={form.taxIdentifier} onChange={(e) => set('taxIdentifier', e.target.value)} />
      <Input className="md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="flex gap-2"><Button type="submit" loading={save.isPending}>{editingId ? 'Save supplier' : 'Create supplier'}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ supplierCode: '', name: '', contactPerson: '', phone: '', email: '', address: '', taxIdentifier: '' }); }}>Cancel</Button>}</div>
      {save.isError && <p className="text-sm text-red-600 md:col-span-3">{(save.error as Error).message}</p>}
    </form>
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Supplier</th><th className="p-3">Contact</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
        <tbody>{(suppliers.data?.items ?? []).map((s) => <tr key={s.id} className="border-t"><td className="p-3">{s.supplierCode}</td><td className="p-3">{s.name}</td><td className="p-3">{s.contactPerson || s.phone || s.email || '—'}</td><td className="p-3">{s.status}</td><td className="space-x-2 p-3 text-right"><Button size="sm" variant="outline" onClick={() => { setEditingId(s.id); setForm({ supplierCode: s.supplierCode, name: s.name, contactPerson: s.contactPerson ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', taxIdentifier: s.taxIdentifier ?? '' }); }}>Edit</Button>{s.status === 'ACTIVE' && <Button size="sm" variant="outline" onClick={() => deactivate.mutate(s.id)}>Deactivate</Button>}</td></tr>)}</tbody>
      </table>
      {suppliers.isLoading && <p className="p-4 text-sm text-slate-500">Loading suppliers…</p>}
      {suppliers.isError && <p className="p-4 text-sm text-red-600">{(suppliers.error as Error).message}</p>}
      {deactivate.isError && <p className="p-4 text-sm text-red-600">{(deactivate.error as Error).message}</p>}
    </div>
  </div>;
}
