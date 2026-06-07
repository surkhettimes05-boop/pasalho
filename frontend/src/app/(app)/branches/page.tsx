'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { organizationApi, Branch } from '@/lib/api/organization';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/toaster';

export default function BranchesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ['branches'],
    queryFn: () => organizationApi.listBranches(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branches</h1>
          <p className="mt-1 text-sm text-slate-500">Geographic distribution hubs</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Branch</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading...
            </div>
          ) : !listQ.data?.items?.length ? (
            <div className="px-4 py-8 text-sm text-slate-500">No branches yet.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name</TH>
                  <TH>City</TH>
                  <TH>District</TH>
                  <TH>Region</TH>
                  <TH>Phone</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {listQ.data.items.map((b: Branch) => (
                  <TR key={b.id}>
                    <TD className="font-mono text-xs">{b.code}</TD>
                    <TD className="font-medium text-slate-900">{b.name}</TD>
                    <TD>{b.city}</TD>
                    <TD>{b.district}</TD>
                    <TD className="text-slate-500">{b.region ?? '—'}</TD>
                    <TD className="font-mono text-xs">{(b as any).phone ?? '—'}</TD>
                    <TD>
                      <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <BranchForm
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['branches'] });
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BranchForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', city: '', district: '', region: '', phone: '', email: '', contactPerson: '' });

  const createMut = useMutation({
    mutationFn: () => api.post('/branches', form),
    onSuccess: () => {
      toast({ title: 'Branch created', variant: 'success' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'error' }),
  });

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Branch</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-4">
          <Input label="Code" value={form.code} onChange={f('code')} placeholder="SURKHET" required />
          <Input label="Name" value={form.name} onChange={f('name')} placeholder="Surkhet Branch" required />
          <Input label="City" value={form.city} onChange={f('city')} required />
          <Input label="District" value={form.district} onChange={f('district')} required />
          <Input label="Region" value={form.region} onChange={f('region')} />
          <Input label="Phone" value={form.phone} onChange={f('phone')} />
          <Input label="Email" value={form.email} onChange={f('email')} />
          <Input label="Contact Person" value={form.contactPerson} onChange={f('contactPerson')} />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.code || !form.name || !form.city || !form.district}
          >
            {createMut.isPending ? <Spinner size="sm" /> : null} Create
          </Button>
        </div>
      </div>
    </div>
  );
}
