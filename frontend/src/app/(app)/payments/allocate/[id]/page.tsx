'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { api } from '@/lib/api/client';
import { formatCurrency, formatDate } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toaster';

export default function PaymentAllocatePage({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const paymentQ = useQuery({
    queryKey: ['payment', params.id],
    queryFn: () => api.get(`/payments/${params.id}`) as Promise<any>,
  });

  const unpaidInvoicesQ = useQuery({
    queryKey: ['unpaid-invoices', paymentQ.data?.retailerId],
    queryFn: () => api.get(`/invoices?retailerId=${paymentQ.data?.retailerId}&paymentStatus=UNPAID,PARTIALLY_PAID`) as Promise<{ items: any[] }>,
    enabled: !!paymentQ.data?.retailerId,
  });

  const allocateMutation = useMutation({
    mutationFn: (data: { allocations: Array<{ invoiceId: string; amount: number }> }) =>
      api.post(`/finance/payments/${params.id}/allocate`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment', params.id] });
      qc.invalidateQueries({ queryKey: ['unpaid-invoices'] });
      toast({ title: 'Payment allocated successfully', variant: 'success' });
    },
  });

  const autoAllocateMutation = useMutation({
    mutationFn: () => api.post(`/finance/payments/${params.id}/auto-allocate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment', params.id] });
      qc.invalidateQueries({ queryKey: ['unpaid-invoices'] });
      toast({ title: 'Payment auto-allocated successfully', variant: 'success' });
    },
  });

  const totalAllocated = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  const remaining = paymentQ.data ? Number(paymentQ.data.amount) - totalAllocated : 0;

  const handleAllocate = () => {
    const allocationItems = Object.entries(allocations)
      .filter(([_, amount]) => amount > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }));

    if (allocationItems.length === 0) {
      toast({ title: 'Please allocate at least one invoice', variant: 'error' });
      return;
    }

    allocateMutation.mutate({ allocations: allocationItems });
  };

  if (paymentQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner size="sm" /> Loading payment...
      </div>
    );
  }

  const payment = paymentQ.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Allocate Payment</h1>
          <p className="mt-1 text-sm text-slate-500">Payment {payment.paymentNumber}</p>
        </div>
        <Button onClick={() => autoAllocateMutation.mutate()} disabled={autoAllocateMutation.isPending}>
          {autoAllocateMutation.isPending ? 'Allocating...' : 'Auto-Allocate'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount</Label>
              <div className="text-lg font-bold">{formatCurrency(payment.amount)}</div>
            </div>
            <div>
              <Label>Method</Label>
              <div className="text-lg">{payment.method}</div>
            </div>
            <div>
              <Label>Date</Label>
              <div>{formatDate(payment.receivedAt)}</div>
            </div>
            <div>
              <Label>Reference</Label>
              <div>{payment.referenceNumber || '—'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <div className="text-sm text-slate-500">Total Allocated</div>
              <div className="text-lg font-bold">{formatCurrency(totalAllocated)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-500">Remaining</div>
              <div className={`text-lg font-bold ${remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(remaining)}
              </div>
            </div>
          </div>

          {unpaidInvoicesQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner size="sm" /> Loading invoices...
            </div>
          ) : !unpaidInvoicesQ.data?.items?.length ? (
            <div className="text-sm text-slate-500">No unpaid invoices found.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Invoice</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Due</TH>
                  <TH className="text-right">Allocate</TH>
                </TR>
              </THead>
              <TBody>
                {unpaidInvoicesQ.data.items.map((invoice: any) => {
                  const currentAllocation = allocations[invoice.id] || 0;
                  const maxAllocation = Number(invoice.dueAmount);

                  return (
                    <TR key={invoice.id}>
                      <TD className="font-mono text-xs">{invoice.invoiceNumber}</TD>
                      <TD className="text-sm text-slate-500">{formatDate(invoice.createdAt)}</TD>
                      <TD className="text-right tabular-nums">{formatCurrency(invoice.grandTotal)}</TD>
                      <TD className="text-right tabular-nums text-red-600">{formatCurrency(invoice.dueAmount)}</TD>
                      <TD className="text-right">
                        <Input
                          type="number"
                          value={currentAllocation || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setAllocations(prev => ({
                              ...prev,
                              [invoice.id]: Math.min(value, maxAllocation)
                            }));
                          }}
                          className="w-24 text-right"
                          placeholder="0"
                          max={maxAllocation}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleAllocate}
              disabled={allocateMutation.isPending || totalAllocated === 0}
            >
              {allocateMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
