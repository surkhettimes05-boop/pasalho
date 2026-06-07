'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { organizationApi, Warehouse } from '@/lib/api/organization';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/toaster';

export default function WarehousesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => organizationApi.listWarehouses(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warehouses</h1>
          <p className="mt-1 text-sm text-slate-500">Physical stock locations per branch</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Warehouse</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading...
            </div>
          ) : !listQ.data?.items?.length ? (
            <div className="px-4 py-8 text-sm text-slate-500">No warehouses yet.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Name</TH>
                  <TH>Branch</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {listQ.data.items.map((w: Warehouse) => (
                  <TR key={w.id}>
                    <TD className="font-mono text-xs">{w.code}</TD>
                    <TD className="font-medium text-slate-900">{w.name}</TD>
                    <TD className="text-sm text-slate-500">{(w as any).branch?.name ?? w.branchId.slice(0, 8)}</TD>
                    <TD>
                      <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <WarehouseForm
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['warehouses'] });
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function WarehouseForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ branchId: '', code: '', name: '' });

  const branchesQ = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => organizationApi.listBranches(),
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/warehouses', form),
    onSuccess: () => {
      toast({ title: 'Warehouse created', variant: 'success' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'error' }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Warehouse</h2>
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
          <Input label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="SURKHET-MAIN" required />
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Surkhet Main Warehouse" required />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.branchId || !form.code || !form.name}
          >
            {createMut.isPending ? <Spinner size="sm" /> : null} Create
          </Button>
        </div>
      </div>
    </div>
  );
}
