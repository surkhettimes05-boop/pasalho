'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { salesApi, Invoice } from '@/lib/api/sales';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

const STATUSES = [
  'ALL',
  'DRAFT',
  'POSTED',
  'PAID',
  'PARTIALLY_PAID',
  'CREDIT_OPEN',
  'VOIDED',
  'CANCELLED',
];

export default function InvoicesListPage() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['invoices', status],
    queryFn: () =>
      salesApi.listInvoices({
        page: 1,
        limit: 100,
      }),
  });

  const items: Invoice[] = (listQ.data?.items ?? []).filter((inv) => {
    if (status !== 'ALL' && inv.status !== status) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.retailer?.shopName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">Sales invoices and POS receipts</p>
        </div>
        <Link href="/invoices/new">
          <Button>+ New Invoice (POS)</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:max-w-sm">
              <Input
                label="Search"
                placeholder="Invoice # or retailer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading invoices...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              No invoices yet. Click &quot;New Invoice (POS)&quot; to create one.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Invoice #</TH>
                  <TH>Date</TH>
                  <TH>Retailer</TH>
                  <TH>Warehouse</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Paid</TH>
                  <TH className="text-right">Due</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((inv) => (
                  <TR
                    key={inv.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => (window.location.href = `/invoices/${inv.id}`)}
                  >
                    <TD className="font-mono text-xs">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</TD>
                    <TD className="text-sm">{formatDate(inv.createdAt)}</TD>
                    <TD className="font-medium text-slate-900">{inv.retailer?.shopName ?? '—'}</TD>
                    <TD className="text-sm">{inv.warehouseId?.slice(0, 8) ?? '—'}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(inv.grandTotal)}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{formatCurrency(inv.paidAmount)}</TD>
                    <TD className="text-right tabular-nums font-semibold text-red-600">
                      {formatCurrency(inv.dueAmount)}
                    </TD>
                    <TD>
                      <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
