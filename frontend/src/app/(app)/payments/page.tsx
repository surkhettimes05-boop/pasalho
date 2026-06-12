'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { salesApi, Retailer } from '@/lib/api/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toaster';

const PAYMENT_METHODS = ['CASH', 'QR', 'BANK', 'WALLET', 'CHEQUE'] as const;

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get('/payments?limit=100') as Promise<{ items: any[]; total: number }>,
  });

  const items = (listQ.data?.items ?? []).filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.paymentNumber?.toLowerCase().includes(q) ||
      p.retailer?.shopName?.toLowerCase().includes(q) ||
      p.method?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">All recorded retailer payments</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Record Payment</Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Search by payment #, retailer, or method..."
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
              <Spinner size="sm" /> Loading payments...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No payments recorded yet.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Payment #</TH>
                  <TH>Date</TH>
                  <TH>Retailer</TH>
                  <TH>Method</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Reference</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((p: any) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs">{p.paymentNumber ?? p.id.slice(0, 8)}</TD>
                    <TD className="text-xs text-slate-500">{formatDateTime(p.receivedAt ?? p.createdAt)}</TD>
                    <TD className="font-medium text-slate-900">{p.retailer?.shopName ?? '—'}</TD>
                    <TD>
                      <Badge variant="blue">{p.method}</Badge>
                    </TD>
                    <TD className="text-right tabular-nums font-semibold text-green-700">
                      {formatCurrency(p.amount)}
                    </TD>
                    <TD className="font-mono text-xs text-slate-500">{p.referenceNumber ?? '—'}</TD>
                    <TD>
                      <Badge variant={p.status === 'VOIDED' ? 'red' : 'green'}>{p.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <CreatePaymentModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['payments'] });
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreatePaymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    branchId: '',
    retailerId: '',
    invoiceId: '',
    amount: '',
    method: 'CASH' as (typeof PAYMENT_METHODS)[number],
    referenceNumber: '',
  });

  const retailersQ = useQuery({
    queryKey: ['retailers-all'],
    queryFn: () => salesApi.listRetailers(),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const retailer = retailersQ.data?.items.find((r) => r.id === form.retailerId);
      return api.post('/payments', {
        branchId: form.branchId || retailer?.branchId,
        retailerId: form.retailerId || undefined,
        invoiceId: form.invoiceId.trim() || undefined,
        amount: Number(form.amount),
        method: form.method,
        referenceNumber: form.referenceNumber.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: 'Payment recorded', variant: 'success' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'error' }),
  });

  const selectedRetailer = retailersQ.data?.items.find((r) => r.id === form.retailerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <Select
            label="Retailer"
            value={form.retailerId}
            onChange={(e) => setForm((f) => ({ ...f, retailerId: e.target.value }))}
          >
            <option value="">— Select retailer (optional) —</option>
            {(retailersQ.data?.items ?? []).map((r: Retailer) => (
              <option key={r.id} value={r.id}>{r.shopName} ({r.code})</option>
            ))}
          </Select>
          <Input
            label="Invoice ID (optional)"
            placeholder="Leave blank for general payment"
            value={form.invoiceId}
            onChange={(e) => setForm((f) => ({ ...f, invoiceId: e.target.value }))}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <Select
            label="Payment Method"
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as any }))}
          >
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input
            label="Reference (optional)"
            placeholder="Cheque #, QR txn ID, bank ref..."
            value={form.referenceNumber}
            onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={createMut.isPending}>Cancel</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !form.amount || Number(form.amount) <= 0}
          >
            {createMut.isPending ? <Spinner size="sm" /> : null} Record
          </Button>
        </div>
      </div>
    </div>
  );
}
