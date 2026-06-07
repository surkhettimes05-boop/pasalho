'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Modal } from '../_components/Modal';
import { salesApi, Invoice } from '@/lib/api/sales';
import { api } from '@/lib/api/client';
import { toast } from '@/components/ui/toaster';
import { formatCurrency, formatDateTime } from '@/lib/utils/cn';

const PAYMENT_METHODS = ['CASH', 'QR', 'BANK', 'WALLET', 'CHEQUE'] as const;

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const invQ = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => salesApi.getInvoice(id!),
    enabled: !!id,
  });

  const postMut = useMutation({
    mutationFn: () => salesApi.postInvoice(id!),
    onSuccess: () => {
      toast({ title: 'Invoice posted', variant: 'success' });
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: (e: Error) => toast({ title: 'Post failed', description: e.message, variant: 'error' }),
  });

  const voidMut = useMutation({
    mutationFn: (reason: string) => salesApi.voidInvoice(id!, reason),
    onSuccess: () => {
      toast({ title: 'Invoice voided', variant: 'success' });
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      setVoidOpen(false);
    },
    onError: (e: Error) => toast({ title: 'Void failed', description: e.message, variant: 'error' }),
  });

  if (invQ.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner size="sm" /> Loading invoice...
      </div>
    );
  }
  if (invQ.isError || !invQ.data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">
          Failed to load invoice: {(invQ.error as Error)?.message ?? 'not found'}
        </p>
        <Link href="/invoices">
          <Button variant="outline">Back to invoices</Button>
        </Link>
      </div>
    );
  }

  const inv: Invoice = invQ.data;
  const canPost = inv.status === 'DRAFT';
  const canPay = ['POSTED', 'CREDIT_OPEN', 'PARTIALLY_PAID'].includes(inv.status);
  const canVoid = ['POSTED', 'CREDIT_OPEN', 'PARTIALLY_PAID'].includes(inv.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {inv.invoiceNumber ?? inv.id.slice(0, 8)}
            </h1>
            <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {inv.retailer?.shopName ?? 'Walk-in / cash'} · {formatDateTime(inv.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices">
            <Button variant="outline">Back</Button>
          </Link>
          {canPost ? (
            <Button onClick={() => postMut.mutate()} disabled={postMut.isPending}>
              {postMut.isPending ? <Spinner size="sm" /> : null} Post
            </Button>
          ) : null}
          {canPay ? (
            <Button onClick={() => setPayOpen(true)}>Record Payment</Button>
          ) : null}
          {canVoid ? (
            <Button variant="outline" onClick={() => setVoidOpen(true)}>
              Void
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 py-4">
            <h2 className="text-sm font-semibold text-slate-700">Totals</h2>
            <Row label="Subtotal" value={formatCurrency(inv.subtotal)} />
            <Row label="Discount" value={formatCurrency(inv.discountTotal)} />
            <Row label="Tax" value={formatCurrency(inv.taxTotal)} />
            <Row label="Grand Total" value={formatCurrency(inv.grandTotal)} bold />
            <Row label="Paid" value={formatCurrency(inv.paidAmount)} />
            <Row label="Due" value={formatCurrency(inv.dueAmount)} bold accent />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-0">
            <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
              Line Items
            </h2>
            {inv.items && inv.items.length > 0 ? (
              <Table>
                <THead>
                  <TR>
                    <TH>Product</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Unit Price</TH>
                    <TH className="text-right">Line Total</TH>
                  </TR>
                </THead>
                <TBody>
                  {inv.items.map((it: any, i: number) => (
                    <TR key={i}>
                      <TD className="font-medium">{it.product?.name ?? it.productName ?? it.productId}</TD>
                      <TD className="text-right tabular-nums">{Number(it.quantity)}</TD>
                      <TD className="text-right tabular-nums">{formatCurrency(it.unitPrice)}</TD>
                      <TD className="text-right tabular-nums font-semibold">
                        {formatCurrency(Number(it.quantity) * Number(it.unitPrice))}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500">No items.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            Payments
          </h2>
          {inv.payments && inv.payments.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Method</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Reference</TH>
                </TR>
              </THead>
              <TBody>
                {inv.payments.map((p: any, i: number) => (
                  <TR key={i}>
                    <TD className="text-xs text-slate-500">{formatDateTime(p.createdAt)}</TD>
                    <TD>{p.paymentMethod}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(p.amount)}</TD>
                    <TD className="font-mono text-xs text-slate-500">{p.reference ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">No payments recorded.</p>
          )}
        </CardContent>
      </Card>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        invoiceId={id!}
        defaultAmount={Number(inv.dueAmount ?? inv.grandTotal) || 0}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['invoice', id] });
          setPayOpen(false);
        }}
      />
      <VoidModal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onSubmit={(reason) => voidMut.mutate(reason)}
        submitting={voidMut.isPending}
      />
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          'tabular-nums ' +
          (bold ? 'font-bold text-slate-900 ' : '') +
          (accent ? 'text-red-600 font-semibold ' : '')
        }
      >
        {value}
      </span>
    </div>
  );
}

function PaymentModal({
  open,
  onClose,
  invoiceId,
  defaultAmount,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  defaultAmount: number;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH');
  const [reference, setReference] = useState('');

  const payMut = useMutation({
    mutationFn: () =>
      api.post('/sales/payments', {
        invoiceId,
        amount: Number(amount),
        paymentMethod: method,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Payment recorded', variant: 'success' });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Payment failed', description: e.message, variant: 'error' }),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      size="sm"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={payMut.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => payMut.mutate()}
            disabled={payMut.isPending || !amount || Number(amount) <= 0}
          >
            {payMut.isPending ? <Spinner size="sm" /> : null} Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as any)}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Input
          label="Reference (optional)"
          placeholder="Receipt #, cheque #, txn id..."
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function VoidModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Void invoice"
      size="sm"
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => onSubmit(reason.trim() || 'No reason provided')}
            disabled={submitting}
          >
            {submitting ? <Spinner size="sm" /> : null} Void invoice
          </Button>
        </>
      }
    >
      <p className="mb-2 text-sm text-slate-600">This will reverse any stock deduction and mark the invoice as voided.</p>
      <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
      <textarea
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why are you voiding this invoice?"
      />
    </Modal>
  );
}
