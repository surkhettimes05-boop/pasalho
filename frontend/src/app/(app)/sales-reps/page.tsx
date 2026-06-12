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
import { api } from '@/lib/api/client';
import { organizationApi } from '@/lib/api/organization';
import { toast } from '@/components/ui/toaster';
import { formatDate } from '@/lib/utils/cn';

export default function SalesRepsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['sales-reps'],
    queryFn: () => api.get('/sales-reps?limit=200') as Promise<{ items: any[]; total: number }>,
  });

  const items = (listQ.data?.items ?? []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.user?.fullName?.toLowerCase().includes(q) ||
      r.user?.email?.toLowerCase().includes(q) ||
      r.employeeCode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Reps</h1>
          <p className="mt-1 text-sm text-slate-500">Field sales representatives by branch</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Sales Rep</Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Search by name, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No sales reps found.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Employee Code</TH>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Branch</TH>
                  <TH>Status</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r: any) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs">{r.employeeCode}</TD>
                    <TD className="font-medium text-slate-900">{r.user?.fullName ?? '—'}</TD>
                    <TD className="text-sm text-slate-500">{r.user?.email ?? '—'}</TD>
                    <TD className="text-sm">{r.branch?.name ?? '—'}</TD>
                    <TD>
                      <Badge variant={r.status === 'ACTIVE' ? 'green' : 'gray'}>{r.status}</Badge>
                    </TD>
                    <TD className="text-xs text-slate-500">{formatDate(r.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <SalesRepForm
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['sales-reps'] });
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SalesRepForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ userId: '', branchId: '', employeeCode: '' });

  const branchesQ = useQuery({
    queryKey: ['branches-all'],
    queryFn: () => organizationApi.listBranches(),
  });

  const usersQ = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.get('/users?limit=200') as Promise<{ items: any[] }>,
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/sales-reps', form),
    onSuccess: () => {
      toast({ title: 'Sales rep created', variant: 'success' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'error' }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Sales Rep</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <Select
            label="User"
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
            required
          >
            <option value="">Select user</option>
            {(usersQ.data?.items ?? []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
            ))}
          </Select>
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
          <Input
            label="Employee Code"
            value={form.employeeCode}
            onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
            placeholder="EMP-001"
            required
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.userId || !form.branchId || !form.employeeCode}
          >
            {createMut.isPending ? <Spinner size="sm" /> : null} Create
          </Button>
        </div>
      </div>
    </div>
  );
}
